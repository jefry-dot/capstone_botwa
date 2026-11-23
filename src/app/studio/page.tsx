import { Suspense } from "react";
import Link from "next/link";
import { ArrowLeft, MessageCircle, ArrowUpRight, Loader2 } from "lucide-react";
import StickerUploader, { type StudioTab } from "@/components/StickerUploader";

const WA_BOT_NUMBER =
  process.env.NEXT_PUBLIC_WA_BOT_NUMBER || "6285959632681";
const WA_BOT_LINK = `https://wa.me/${WA_BOT_NUMBER}?text=${encodeURIComponent(
  "/help"
)}`;

const VALID_TABS = new Set<StudioTab>([
  "photo",
  "ai_meme",
  "quote_chat",
  "brat_text",
  "breaking_news",
]);

interface StudioPageProps {
  searchParams: Promise<{ mode?: string }>;
}

export default async function StudioPage({ searchParams }: StudioPageProps) {
  const params = await searchParams;
  const rawMode = params.mode as StudioTab | undefined;
  const initialTab: StudioTab =
    rawMode && VALID_TABS.has(rawMode) ? rawMode : "photo";

  return (
    <div className="space-y-8">
      {/* Header Meja Kerja Studio */}
      <section className="flex flex-col justify-between gap-4 border-b-2 border-[#161614] pb-6 sm:flex-row sm:items-end">
        <div className="space-y-2">
          <Link
            href="/"
            className="inline-flex items-center gap-1.5 font-mono text-xs font-bold uppercase text-[#5C584F] hover:text-[#161614] hover:underline"
          >
            <ArrowLeft className="h-3.5 w-3.5" />
            <span>Kembali ke Profil Studio</span>
          </Link>

          <h1 className="font-display text-3xl font-bold tracking-tight text-[#161614] sm:text-4xl">
            Web Sticker Workbench
          </h1>
          <p className="max-w-2xl text-sm text-[#45433D]">
            Pilih mode stiker di bawah, unggah gambar atau ketik teks, lalu
            unduh hasil <code className="font-mono font-bold">.webp</code>{" "}
            ukuran 512×512 (&lt; 100 KB) siap pakai.
          </p>
        </div>

        <a
          href={WA_BOT_LINK}
          target="_blank"
          rel="noopener noreferrer"
          className="zine-btn inline-flex w-fit shrink-0 items-center gap-2 bg-[#FFFDF7] px-4 py-2.5 font-mono text-xs font-bold uppercase text-[#161614]"
        >
          <MessageCircle className="h-4 w-4" />
          <span>Pakai via Bot WA</span>
          <ArrowUpRight className="h-3.5 w-3.5" />
        </a>
      </section>

      {/* Interactive 5-Mode Workbench */}
      <section>
        <Suspense
          fallback={
            <div className="zine-card flex h-80 items-center justify-center">
              <Loader2 className="h-7 w-7 animate-spin text-[#161614]" />
            </div>
          }
        >
          <StickerUploader initialTab={initialTab} />
        </Suspense>
      </section>
    </div>
  );
}
