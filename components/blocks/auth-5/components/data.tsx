import type { ReactNode } from "react"

import { AnthropicBlackWordmark } from "@/components/ui/svgs/anthropicBlackWordmark"
import { AnthropicWhiteWordmark } from "@/components/ui/svgs/anthropicWhiteWordmark"
import { MintlifyWordmarkDark } from "@/components/ui/svgs/mintlifyWordmarkDark"
import { MintlifyWordmarkLight } from "@/components/ui/svgs/mintlifyWordmarkLight"
import { OpenaiWordmarkDark } from "@/components/ui/svgs/openaiWordmarkDark"
import { OpenaiWordmarkLight } from "@/components/ui/svgs/openaiWordmarkLight"
import { ResendWordmarkBlack } from "@/components/ui/svgs/resendWordmarkBlack"
import { ResendWordmarkWhite } from "@/components/ui/svgs/resendWordmarkWhite"
import { SlackWordmark } from "@/components/ui/svgs/slackWordmark"
import { StripeWordmark } from "@/components/ui/svgs/stripeWordmark"

export type TrustBrand = {
  id: string
  name: string
  logo: ReactNode
}

function ThemeLogo({ light, dark }: { light: ReactNode; dark?: ReactNode }) {
  if (!dark) {
    return light
  }

  return (
    <>
      <span aria-hidden="true" className="dark:hidden">
        {light}
      </span>
      <span aria-hidden="true" className="hidden dark:block">
        {dark}
      </span>
    </>
  )
}

// Heights stay within a tight range so the full logo row reads as one system.
export const AUTH5_TRUST_BRANDS: TrustBrand[] = [
  {
    id: "stripe",
    name: "Stripe",
    logo: <StripeWordmark className="h-[18px] w-auto" aria-hidden="true" />,
  },
  {
    id: "openai",
    name: "OpenAI",
    logo: (
      <ThemeLogo
        light={
          <OpenaiWordmarkLight className="h-[18px] w-auto" aria-hidden="true" />
        }
        dark={
          <OpenaiWordmarkDark className="h-[18px] w-auto" aria-hidden="true" />
        }
      />
    ),
  },
  {
    id: "anthropic",
    name: "Anthropic",
    logo: (
      <ThemeLogo
        light={
          <AnthropicBlackWordmark
            className="h-[13px] w-auto"
            aria-hidden="true"
          />
        }
        dark={
          <AnthropicWhiteWordmark
            className="h-[13px] w-auto"
            aria-hidden="true"
          />
        }
      />
    ),
  },
  {
    id: "slack",
    name: "Slack",
    logo: (
      <SlackWordmark
        className="text-foreground h-[17px] w-auto"
        aria-hidden="true"
      />
    ),
  },
  {
    id: "mintlify",
    name: "Mintlify",
    logo: (
      <ThemeLogo
        light={
          <MintlifyWordmarkLight
            className="h-[16px] w-auto"
            aria-hidden="true"
          />
        }
        dark={
          <MintlifyWordmarkDark
            className="h-[16px] w-auto"
            aria-hidden="true"
          />
        }
      />
    ),
  },
  {
    id: "resend",
    name: "Resend",
    logo: (
      <ThemeLogo
        light={
          <ResendWordmarkBlack className="h-[13px] w-auto" aria-hidden="true" />
        }
        dark={
          <ResendWordmarkWhite className="h-[13px] w-auto" aria-hidden="true" />
        }
      />
    ),
  },
]
