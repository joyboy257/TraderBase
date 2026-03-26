import type { Metadata } from "next";
import "@/styles/globals.css";

export const metadata: Metadata = {
  title: "AfterHours — Follow the Best Traders",
  description:
    "Social copy trading platform. Follow successful investors and automatically copy their trades.",
  icons: {
    icon: "/favicon.svg",
  },
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
