import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "TeamCodeLocked Certificates | Powered by BitByBit",
  description:
    "Official Certificate Portal for TeamCodeLocked Club Orientation attendees at BMSCE. Verify credentials and compete in code duels on BitByBit.",
  keywords: [
    "TeamCodeLocked",
    "BitByBit",
    "BMSCE",
    "Certificate Portal",
    "Orientation Certificate",
    "Competitive Programming",
  ],
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" className="dark h-full antialiased">
      <body
        className={`${geistSans.variable} ${geistMono.variable} min-h-screen bg-zinc-950 text-zinc-100 font-sans selection:bg-zinc-800 selection:text-zinc-100 flex flex-col`}
      >
        {children}
      </body>
    </html>
  );
}
