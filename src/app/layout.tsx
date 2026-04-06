import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "AgentHub — AI Agents Marketplace",
  description: "Discover, deploy, and build with autonomous AI agents",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body className="antialiased">{children}</body>
    </html>
  );
}
