import { defaultBackend, defineSandbox } from "eve/sandbox";

/**
 * Prototype computation sandbox.
 *
 * The model still has no generic shell/file tools (`defaultTools: false`).
 * Authored tools may run only the scripts committed under workspace/scripts.
 */
export default defineSandbox({
  backend: defaultBackend({
    vercel: {
      networkPolicy: "deny-all",
      resources: { vcpus: 2 },
    },
    docker: { networkPolicy: "deny-all" },
    microsandbox: {
      networkPolicy: "deny-all",
      memoryMiB: 2_048,
    },
  }),
  revalidationKey: () => "marketing-ops-prototype-scripts-v1",
  async bootstrap({ use: acquireSandbox }) {
    const sandbox = await acquireSandbox();
    const result = await sandbox.run({
      command: "node scripts/prototype-runner.mjs self-test",
    });
    if (result.exitCode !== 0) {
      throw new Error(
        `Prototype sandbox bootstrap failed (exit ${result.exitCode}): ${result.stderr || result.stdout}`,
      );
    }
  },
});
