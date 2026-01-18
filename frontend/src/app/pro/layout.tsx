import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "PRO Membership | HYPD Games",
  description: "Upgrade to HYPD PRO for an ad-free gaming experience, cloud saves, HD quality, and early access to new games.",
  openGraph: {
    title: "PRO Membership | HYPD Games",
    description: "Go PRO for an ad-free gaming experience and exclusive features!",
    type: "website",
    siteName: "HYPD Games",
  },
  twitter: {
    card: "summary",
    title: "PRO Membership | HYPD Games",
    description: "Go PRO for an ad-free gaming experience and exclusive features!",
  },
};

export default function ProLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return children;
}
