import type { Metadata } from "next";
import { Inter } from "next/font/google";
import Navbar from "@/components/Navbar";
import { getCurrentAdmin } from "@/lib/auth";
import "./globals.css";

const inter = Inter({
  subsets: ["latin"],
  display: "swap",
});

export const metadata: Metadata = {
  title: "WA AI Sticker Studio — WhatsApp Bot & Web Studio",
  description:
    "Platform pembuat stiker WhatsApp berbasis AI Vision (Gemini Flash) & SVG Template dengan Web Studio dan Live Telemetry Dashboard.",
};

export default async function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  const admin = await getCurrentAdmin();

  return (
    <html lang="id">
      <body
        className={`${inter.className} min-h-screen bg-slate-50 text-slate-900 antialiased`}
      >
        <div className="flex min-h-screen flex-col">
          <Navbar admin={admin} />
          <main className="mx-auto w-full max-w-6xl flex-1 px-4 py-8 sm:px-6">
            {children}
          </main>
          <footer className="border-t border-slate-200 bg-white">
            <div className="mx-auto flex max-w-6xl flex-col items-center justify-between gap-2 px-4 py-5 text-xs text-slate-500 sm:flex-row sm:px-6">
              <p className="font-medium text-slate-600">
                WA AI Sticker Studio — Capstone Project
              </p>
              <p>
                Next.js App Router • Sharp SVG Engine • Meta Cloud API • Gemini Vision • Supabase
              </p>
            </div>
          </footer>
        </div>
      </body>
    </html>
  );
}
