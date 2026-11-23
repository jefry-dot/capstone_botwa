import type { Metadata } from "next";
import Link from "next/link";
import Navbar from "@/components/Navbar";
import { getCurrentAdmin } from "@/lib/auth";
import "./globals.css";

export const metadata: Metadata = {
  title: "AmbaBot Studio — Mesin Stiker WhatsApp & Web Press",
  description:
    "Studio pembuat stiker WhatsApp anti-mainstream: AI Auto-Meme, Fake Quote Chat, Brat Text, dan Frame LIVE Breaking News langsung dari browser atau chat WA.",
};

export default async function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  const admin = await getCurrentAdmin();

  return (
    <html lang="id">
      <body className="min-h-screen font-sans text-[#161614] antialiased selection:bg-[#B9F32B] selection:text-[#161614]">
        <div className="flex min-h-screen flex-col">
          {/* Strip Cetak Atas */}
          <div className="border-b-2 border-[#161614] bg-[#161614] px-4 py-1.5 text-[#F5F0E6]">
            <div className="mx-auto flex max-w-6xl flex-wrap items-center justify-between gap-2 font-mono text-[11px] tracking-wide">
              <span>AMBABOT STICKER PRESS // CAPSTONE PROJECT 2026</span>
              <span className="hidden text-[#B9F32B] sm:inline">
                512×512 WEBP &lt;100KB • TANPA LOGIN • WA BOT + WEB STUDIO
              </span>
            </div>
          </div>

          <Navbar admin={admin} />

          <main className="mx-auto w-full max-w-6xl flex-1 px-4 py-8 sm:px-6 sm:py-10">
            {children}
          </main>

          <footer className="mt-12 border-t-2 border-[#161614] bg-[#EFE7D8]">
            <div className="mx-auto grid max-w-6xl gap-6 px-4 py-8 sm:grid-cols-3 sm:px-6">
              <div className="space-y-2">
                <p className="font-display text-base font-bold tracking-tight">
                  AMBABOT STUDIO.
                </p>
                <p className="text-xs leading-relaxed text-[#45433D]">
                  Workshop digital pembuat stiker WhatsApp berbasis mesin Sharp
                  SVG &amp; Gemini Vision. Dibangun terbuka untuk dicoba siapa
                  saja tanpa daftar akun.
                </p>
              </div>

              <div className="space-y-1.5 text-xs">
                <p className="font-mono text-[11px] font-bold uppercase tracking-wider text-[#5C584F]">
                  Navigasi Cepat
                </p>
                <div className="flex flex-col gap-1 font-medium">
                  <Link href="/" className="w-fit hover:underline">
                    01. Profil &amp; Tentang Studio
                  </Link>
                  <Link href="/studio" className="w-fit hover:underline">
                    02. Web Sticker Studio
                  </Link>
                  <Link href="/admin/login" className="w-fit hover:underline">
                    03. Portal Admin &amp; Telemetri
                  </Link>
                </div>
              </div>

              <div className="space-y-1.5 text-xs sm:text-right">
                <p className="font-mono text-[11px] font-bold uppercase tracking-wider text-[#5C584F]">
                  Spesifikasi Mesin
                </p>
                <p className="font-mono text-[11px] text-[#3B3934]">
                  Next.js App Router • Sharp SVG • Baileys + Cloud API • Gemini
                  Vision • Supabase
                </p>
                <p className="pt-1 font-mono text-[11px] text-[#6B675D]">
                  © 2026 AmbaBot Studio — Project Capstone
                </p>
              </div>
            </div>
          </footer>
        </div>
      </body>
    </html>
  );
}
