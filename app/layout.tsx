import type { Metadata } from "next";
import "@fontsource/baloo-2/800.css";
import "@fontsource/khand/500.css";
import "@fontsource/khand/600.css";
import "@fontsource/khand/700.css";
import "@fontsource/hind-vadodara/400.css";
import "@fontsource/hind-vadodara/500.css";
import "@fontsource/hind-vadodara/600.css";
import "@fontsource/jetbrains-mono/500.css";
import "./globals.css";

export const metadata: Metadata = {
  title: "मीटर डाउन FM — Dilli ki sadkon ka radio",
  description:
    "दिल्ली की सड़कों के लिए एक गर्म, साझा रेडियो — meter down, music on.",
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="hi">
      <body>{children}</body>
    </html>
  );
}
