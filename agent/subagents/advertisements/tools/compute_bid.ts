import { defineTool } from "eve/tools";
import { z } from "zod";
import {
  FEATURE_NAMES,
  loadBidRequests,
  loadCreatives,
  loadImpressions,
  loadPublishers,
  loadUsers,
  responseFeatures,
} from "../lib/data";
import { fitLogistic, predictLogistic } from "../lib/models";
import { brandProximity } from "../lib/proximity";
import { inventoryQuality, poolAverageQuality } from "../lib/inventory";
import { DEFAULT_SCALINGS, computeBid, pacingFactor } from "../lib/bidding";

export default defineTool({
  outputSchema: z.looseObject({}),
  description:
    "Run the full bid pipeline for one or many bid requests: phi(u), psi_a(u), omega_a(u,i), then b(u) = b_base * s1(psi) * s2(omega/omega_bar), capped by the value and target-CPA ceilings, checked against the floor, and scaled by budget pacing. Returns every intermediate term, the expected CPA at the bid, and the no-bid reason where applicable.",
  inputSchema: z.object({
    creativeId: z.string(),
    requestIds: z.array(z.string()).optional().describe("Omit to score a batch from the stream."),
    batchSize: z.number().int().min(1).max(200).default(20),
    responseExponent: z.number().min(0).max(4).default(DEFAULT_SCALINGS.responseExponent),
    qualityExponent: z.number().min(0).max(4).default(DEFAULT_SCALINGS.qualityExponent),
    maxScale: z.number().min(1).max(20).default(DEFAULT_SCALINGS.maxScale),
    pacing: z
      .object({
        budgetSpent: z.number().min(0),
        budgetTotal: z.number().min(0),
        elapsedShare: z.number().min(0).max(1),
      })
      .optional(),
    detailRows: z.number().int().min(0).max(50).default(5),
  }),
  label: { start: ({ creativeId }) => `Compute bids · ${creativeId}` },
  async execute(input) {
    const [requests, users, publishers, creatives, impressions] = await Promise.all([
      loadBidRequests(),
      loadUsers(),
      loadPublishers(),
      loadCreatives(),
      loadImpressions(),
    ]);
    const creative = creatives.rows.find((c) => c.id === input.creativeId);
    if (!creative) throw new Error(`No creative "${input.creativeId}".`);
    const U = new Map(users.rows.map((u) => [u.id, u]));
    const P = new Map(publishers.rows.map((p) => [p.id, p]));
    const C = new Map(creatives.rows.map((c) => [c.id, c]));

    // Fit psi on conversions, never on clicks.
    const trainingRows = impressions.rows.map((impression) => {
      const user = U.get(impression.userId)!;
      const publisher = P.get(impression.publisherId)!;
      const trainCreative = C.get(impression.creativeId)!;
      const phi = brandProximity(user, trainCreative).phi;
      return {
        features: responseFeatures({ phi, user, publisher, position: impression.position, hour: impression.hour }),
        label: impression.converted ? 1 : 0,
      };
    });
    const psiModel = fitLogistic(trainingRows, [...FEATURE_NAMES], { iterations: 300 });

    const selected = input.requestIds?.length
      ? requests.rows.filter((r) => input.requestIds!.includes(r.id))
      : requests.rows.slice(0, input.batchSize);
    if (selected.length === 0) throw new Error("No matching bid requests.");

    const omegaBar = poolAverageQuality(
      requests.rows.slice(0, 200).map((r) => {
        const user = U.get(r.userId)!;
        const publisher = P.get(r.publisherId)!;
        return inventoryQuality({ publisher, user, creative, position: r.position }).omega;
      }),
    );
    const psiBar = psiModel.baseRate;

    const pacing = input.pacing
      ? pacingFactor({ ...input.pacing })
      : { factor: 1, state: "on_pace" as const, spendShare: 0 };

    const scalings = {
      responseExponent: input.responseExponent,
      qualityExponent: input.qualityExponent,
      minScale: DEFAULT_SCALINGS.minScale,
      maxScale: input.maxScale,
    };

    const results = selected.map((request) => {
      const user = U.get(request.userId)!;
      const publisher = P.get(request.publisherId)!;
      const phi = brandProximity(user, creative);
      const psi = predictLogistic(
        psiModel,
        responseFeatures({ phi: phi.phi, user, publisher, position: request.position, hour: request.hour }),
      );
      const omega = inventoryQuality({ publisher, user, creative, position: request.position });
      const bid = computeBid({
        baseBidCpm: creative.baseBidCpm,
        psi,
        psiBar,
        omega: omega.omega,
        omegaBar,
        floorCpm: request.floorCpm,
        conversionValue: creative.conversionValue,
        targetCpa: creative.targetCpa,
        pacingFactor: pacing.factor,
        scalings,
      });
      return {
        requestId: request.id,
        userId: user.id,
        publisher: { id: publisher.id, domain: publisher.domain, tier: publisher.tier },
        phi: phi.phi,
        phiBand: phi.band,
        psi: Math.round(psi * 1e6) / 1e6,
        omega: omega.omega,
        bidCpm: bid.bidCpm,
        submitted: bid.submitted,
        reason: bid.reason,
        flags: omega.flags,
        components: bid.components,
        expected: bid.expected,
      };
    });

    const submitted = results.filter((r) => r.submitted);

    return {
      provenance: requests.provenance,
      warning: requests.warning,
      creative: { id: creative.id, baseBidCpm: creative.baseBidCpm, targetCpa: creative.targetCpa, conversionValue: creative.conversionValue },
      normalizers: { psiBar: Math.round(psiBar * 1e6) / 1e6, omegaBar },
      psiModel: { auc: psiModel.auc, positives: Math.round(psiModel.baseRate * psiModel.n), n: psiModel.n, trainedOn: "conversions" },
      pacing,
      scalings,
      evaluated: results.length,
      submittedBids: submitted.length,
      noBids: results.length - submitted.length,
      bidCpm: {
        mean: submitted.length === 0 ? 0 : Math.round((submitted.reduce((s, r) => s + r.bidCpm, 0) / submitted.length) * 1e4) / 1e4,
        max: submitted.length === 0 ? 0 : Math.max(...submitted.map((r) => r.bidCpm)),
      },
      expectedCpa:
        submitted.length === 0
          ? null
          : Math.round(
              (submitted.reduce((s, r) => s + r.bidCpm, 0) /
                Math.max(1e-9, submitted.reduce((s, r) => s + r.expected.conversionsPerThousand, 0))) * 1e4,
            ) / 1e4,
      rows: results.slice(0, input.detailRows),
      nextStep:
        "Simulate clearing with simulate_auction before committing a bid policy: a bid that wins everything is usually a bid that is too high.",
    };
  },
});
