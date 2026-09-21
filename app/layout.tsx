import type { Metadata, Viewport } from "next";
import "./styles/globals.css";
import { Providers } from "./providers";
import { TooltipProvider } from "@/components/ui/tooltip";

export const metadata: Metadata = {
  metadataBase: new URL(
    process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000",
  ),
  title: {
    default: "Marketing Ops | Algorithmic Marketing Operations",
    template: "%s | Marketing Ops",
  },
  description:
    "Algorithmic marketing operations platform. Orchestrate budget allocation, campaign validation, and automated reallocation across promotions, advertisements, recommendations, and pricing.",
  keywords: [
    "marketing operations",
    "algorithmic marketing",
    "budget allocation",
    "campaign optimization",
    "marketing mix modeling",
    "incrementality measurement",
  ],
  authors: [{ name: "Marketing Ops Team" }],
  creator: "Marketing Ops",
  publisher: "Marketing Ops",
  robots: "index, follow",
  openGraph: {
    type: "website",
    locale: "en_US",
    url: "https://marketing-ops.vercel.app",
    siteName: "Marketing Ops",
    title: "Marketing Ops | Algorithmic Marketing Operations",
    description:
      "Orchestrate budget allocation, campaign validation, and automated reallocation.",
    images: [
      {
        url: "/og-image.png",
        width: 1200,
        height: 630,
        alt: "Marketing Ops Dashboard",
      },
    ],
  },
  twitter: {
    card: "summary_large_image",
    title: "Marketing Ops",
    description:
      "Algorithmic marketing operations platform for budget allocation and campaign optimization.",
    images: ["/og-image.png"],
  },
};

export const viewport: Viewport = {
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: "white" },
    { media: "(prefers-color-scheme: dark)", color: "#000000" },
  ],
  width: "device-width",
  initialScale: 1,
  maximumScale: 5,
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body className="font-sans antialiased">
        <TooltipProvider>
          <Providers>{children}</Providers>
        </TooltipProvider>
      </body>
    </html>
  );
}
