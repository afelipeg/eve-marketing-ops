"use client";

import { type ReactNode } from "react";
import { PostHogProvider } from "posthog-js/react";

interface ProvidersProps {
  children: ReactNode;
}

export function Providers({ children }: ProvidersProps) {
  const apiKey = process.env.NEXT_PUBLIC_POSTHOG_KEY;

  if (!apiKey) return <>{children}</>;

  return (
    <PostHogProvider
      apiKey={apiKey}
      options={{
        api_host:
          process.env.NEXT_PUBLIC_POSTHOG_HOST ?? "https://us.i.posthog.com",
        capture_pageleave: true,
        capture_pageview: "history_change",
        person_profiles: "identified_only",
      }}
    >
      {children}
    </PostHogProvider>
  );
}
