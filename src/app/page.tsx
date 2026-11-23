import Link from "next/link";
import {
  ArrowRight,
  ArrowUpRight,
  Check,
  X,
  MessageCircle,
  Terminal,
  Sparkles,
} from "lucide-react";

const WA_BOT_NUMBER =
  process.env.NEXT_PUBLIC_WA_BOT_NUMBER || "6285959632681";
const WA_BOT_DISPLAY = "+62 859-5963-2681";
const WA_BOT_LINK = `https://wa.me/${WA_BOT_NUMBER}?text=${encodeURIComponent(
  "/help"
)}`;

const STICKER_MODES = [
  {
    num: "01",
    tab: "ai_meme",
    tag: "AI VISION",
    tagBg: "bg-[#FFD646]",
    title: "AI Auto-Meme & Roast",
    cmd: ["/aimeme", "/roast"],
    desc: "Kirim foto ekspresi teman atau momen random. Gemini Vision membaca isi foto lalu menulis punchline komedi atau roasting kampus otomatis.",
    span: "lg:col-span-7",
  },
  {
    num: "02",
    tab: "quote_chat",
    tag: "TANPA FOTO",
    tagBg: "bg-[#B9F32B]",
    title: "Fake Quote Chat Bubble",
    cmd: ["/qc Besok bimbingan jam 8!"],
    desc: "Cukup ketik teks atau reply chat teman di grup. Langsung jadi stiker bubble WhatsApp Dark Mode lengkap dengan inisial, jam WIB, dan centang biru.",
    span: "lg:col-span-5",
  },
  {
    num: "03",
    tab: "brat_text",
    tag: "TIPOGRAFI",
    tagBg: "bg-[#B9F32B]",
    title: "Brat Typography Press",
    cmd: ["/brat lagi pusing revisi bab 4"],
    desc: "Ubah curhatan singkat jadi stiker kotak hijau #8ACE00 bergaya low-fi blur yang ringan di bawah 10 KB.",
    span: "lg:col-span-4",
  },
  {
    num: "04",
    tab: "breaking_news",
    tag: "FRAME TV",
    tagBg: "bg-[#EB3B2E] text-white",
    title: "LIVE Breaking News",
    cmd: ["/news Mahasiswa Belum Tidur 2 Hari"],
    desc: "Pasang fotomu ke dalam bingkai siaran televisi lengkap dengan badge LIVE merah, jam WIB, dan ticker berita bawah.",
    span: "lg:col-span-4",
  },
  {
    num: "05",
    tab: "photo",
    tag: "FOTO & MEME",
    tagBg: "bg-[#EFE7D8]",
    title: "Standard, Crop & Meme Klasik",
    cmd: ["/stiker", "/crop", "/stiker Atas | Bawah"],
    desc: "Konversi foto presisi 512×512 WebP di bawah 100 KB, baik utuh transparan (contain), kotak penuh (cover), maupun teks meme tebal.",
    span: "lg:col-span-4",
  },
];

const COMPARISON_ROWS = [
  {
    feature: "Potong foto jadi stiker polos",
    waNative: true,
    ambabot: true,
  },
  {
    feature: "AI baca foto & karang teks meme / roast",
    waNative: false,
    ambabot: true,
  },
  {
    feature: "Stiker bubble chat WA (/qc) dari teks",
    waNative: false,
    ambabot: true,
  },
  {
    feature: "Bingkai LIVE Breaking News & teks Brat",
    waNative: false,
    ambabot: true,
  },
  {
    feature: "Bisa dipakai langsung di Grup WA & Browser",
    waNative: false,
    ambabot: true,
  },
  {
    feature: "Kompresi otomatis 512×512 WebP < 100 KB",
    waNative: false,
    ambabot: true,
  },
];

export default function CompanyProfilePage() {
  return (
    <div className="space-y-16 pb-6 sm:space-y-20">
      {/* ================================================================= */}
      {/* HERO SECTION — ASYMMETRIC ZINE EDITORIAL                          */}
      {/* ================================================================= */}
      <section className="grid items-center gap-10 lg:grid-cols-12">
        {/* Kiri: Profil & CTA Pilihan */}
        <div className="space-y-6 lg:col-span-7">
          <div className="inline-flex items-center gap-2 border-2 border-[#161614] bg-[#FFD646] px-3 py-1 font-mono text-xs font-bold uppercase tracking-wider shadow-[2px_2px_0_#161614]">
            <span>STUDIO STIKER DIGITAL</span>
            <span>•</span>
            <span>GRATIS &amp; TANPA LOGIN</span>
          </div>

          <h1 className="font-display text-4xl leading-[1.05] font-bold tracking-tight text-[#161614] sm:text-5xl lg:text-[56px]">
            Bikin stiker WA yang{" "}
            <span className="relative inline-block">
              <span className="relative z-10">nggak pasaran.</span>
              <span
                aria-hidden="true"
                className="absolute right-0 bottom-1 left-0 z-0 h-3.5 -rotate-1 bg-[#B9F32B]"
              />
            </span>
          </h1>

          <p className="max-w-xl text-base leading-relaxed text-[#3B3934] sm:text-lg">
            <strong>AmbaBot Studio</strong> adalah mesin pembuat stiker WhatsApp
            otomatis dengan AI Vision dan template viral. Bisa langsung dipakai
            lewat browser di <strong>Web Studio</strong>, atau cukup kirim foto
            &amp; teks ke <strong>Bot WhatsApp</strong> kami.
          </p>

          {/* 2 Pilihan Aksi Utama */}
          <div className="flex flex-wrap items-center gap-3.5 pt-1">
            <Link
              href="/studio"
              className="zine-btn inline-flex items-center gap-2.5 bg-[#B9F32B] px-6 py-3.5 font-display text-sm font-bold text-[#161614] sm:text-base"
            >
              <span>Coba Sekarang di Web</span>
              <ArrowRight className="h-4 w-4" />
            </Link>

            <a
              href={WA_BOT_LINK}
              target="_blank"
              rel="noopener noreferrer"
              className="zine-btn inline-flex items-center gap-2 bg-[#FFFDF7] px-5 py-3.5 font-display text-sm font-bold text-[#161614] sm:text-base"
            >
              <MessageCircle className="h-4 w-4" />
              <span>Chat Bot WhatsApp</span>
              <ArrowUpRight className="h-4 w-4" />
            </a>
          </div>

          {/* Info Singkat Spesifikasi */}
          <div className="flex flex-wrap gap-x-6 gap-y-2 border-t-2 border-dashed border-[#161614]/30 pt-4 font-mono text-xs text-[#45433D]">
            <span>• 5 Mode Stiker Siap Pakai</span>
            <span>• Output 512×512 WebP &lt;100KB</span>
            <span>• Jalan di DM &amp; Grup WA</span>
          </div>
        </div>

        {/* Kanan: Papan Kolase Stiker Tempelan (Visual Nyata, Bukan Kartu Generik) */}
        <div className="lg:col-span-5">
          <div className="relative border-2 border-[#161614] bg-[#EFE7D8] p-5 shadow-[6px_6px_0_#161614] sm:p-6">
            {/* Selotip Kertas Atas */}
            <div
              aria-hidden="true"
              className="absolute -top-3 left-1/2 h-6 w-24 -translate-x-1/2 -rotate-2 border border-[#161614]/30 bg-[#FFD646]/85"
            />

            <div className="mb-4 flex items-center justify-between font-mono text-[10px] font-bold uppercase tracking-wider text-[#5C584F]">
              <span>CONTOH HASIL CETAK // 512PX</span>
              <span>LIVE PREVIEW</span>
            </div>

            <div className="grid grid-cols-2 gap-3.5">
              {/* Mockup Stiker 1: Quote Bubble (/qc) */}
              <div className="col-span-2 -rotate-1 border-2 border-[#161614] bg-[#FFFDF7] p-3 shadow-[3px_3px_0_#161614]">
                <div className="flex items-start gap-2.5">
                  <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-[#65AADD] font-mono text-xs font-bold text-white">
                    KK
                  </div>
                  <div className="flex-1 rounded-xl rounded-tl-none bg-[#202C33] px-3 py-2 text-left">
                    <p className="text-[11px] font-bold text-[#65AADD]">
                      Ketua Kelompok
                    </p>
                    <p className="mt-0.5 text-xs leading-snug text-[#E9EDEF]">
                      Besok bimbingan jam 8 pagi, yang telat traktir kopi!
                    </p>
                    <p className="mt-1 text-right font-mono text-[9px] text-[#53BDEB]">
                      09:41 ✓✓
                    </p>
                  </div>
                </div>
                <div className="mt-2 flex items-center justify-between font-mono text-[10px] text-[#5C584F]">
                  <span>/qc &lt;teks&gt;</span>
                  <span>8.4 KB • WEBP</span>
                </div>
              </div>

              {/* Mockup Stiker 2: Brat Text */}
              <div className="rotate-2 border-2 border-[#161614] bg-[#8ACE00] p-3.5 shadow-[3px_3px_0_#161614]">
                <div className="flex aspect-square flex-col items-center justify-center text-center">
                  <p className="font-sans text-lg leading-tight font-medium tracking-tight text-[#111] blur-[0.4px]">
                    lagi pusing revisi bab 4
                  </p>
                </div>
                <p className="mt-1.5 border-t border-[#161614]/25 pt-1 font-mono text-[9px] font-bold text-[#161614]">
                  /brat • 5.7 KB
                </p>
              </div>

              {/* Mockup Stiker 3: Breaking News TV */}
              <div className="-rotate-2 border-2 border-[#161614] bg-[#1E3A5F] p-2.5 shadow-[3px_3px_0_#161614]">
                <div className="flex aspect-square flex-col justify-between">
                  <div className="flex justify-end">
                    <span className="inline-flex items-center gap-1 bg-[#DC2626] px-1.5 py-0.5 font-mono text-[9px] font-bold text-white">
                      ● LIVE
                    </span>
                  </div>
                  <div className="space-y-0.5">
                    <div className="flex">
                      <span className="bg-[#DC2626] px-1.5 py-0.5 font-mono text-[8px] font-bold text-white">
                        BREAKING NEWS
                      </span>
                      <span className="bg-white px-1 py-0.5 font-mono text-[8px] font-bold text-[#161614]">
                        10:00
                      </span>
                    </div>
                    <div className="border-l-2 border-[#DC2626] bg-[#0F172A] px-1.5 py-1">
                      <p className="font-display text-[10px] leading-tight font-bold text-white uppercase">
                        MAHASISWA INI BELUM TIDUR 2 HARI
                      </p>
                    </div>
                  </div>
                </div>
                <p className="mt-1.5 font-mono text-[9px] font-bold text-[#FDE047]">
                  /news • 11.9 KB
                </p>
              </div>
            </div>

            {/* Badge AI Vision di Pojok Bawah */}
            <div className="mt-3.5 flex items-center justify-between border-2 border-[#161614] bg-[#161614] px-3 py-2 text-[#F5F0E6]">
              <div className="flex items-center gap-2 font-mono text-[11px]">
                <Sparkles className="h-3.5 w-3.5 text-[#B9F32B]" />
                <span>+ AI Vision Auto-Meme (/aimeme &amp; /roast)</span>
              </div>
              <Link
                href="/studio?mode=ai_meme"
                className="font-mono text-[11px] font-bold text-[#FFD646] hover:underline"
              >
                Tes →
              </Link>
            </div>
          </div>
        </div>
      </section>

      {/* ================================================================= */}
      {/* SECTION 01 — TENTANG STUDIO & KENAPA BEDA DARI BAWAAN WA          */}
      {/* ================================================================= */}
      <section
        id="tentang"
        className="grid gap-8 border-t-2 border-[#161614] pt-12 lg:grid-cols-12"
      >
        <div className="space-y-4 lg:col-span-6">
          <p className="font-mono text-xs font-bold uppercase tracking-widest text-[#5C584F]">
            01 // TENTANG AMBABOT STUDIO
          </p>
          <h2 className="font-display text-3xl leading-tight font-bold tracking-tight sm:text-4xl">
            Bukan sekadar potong foto jadi stiker.
          </h2>
          <p className="text-sm leading-relaxed text-[#3B3934] sm:text-base">
            Di aplikasi WhatsApp sekarang memang sudah ada tombol pembuat stiker
            bawaan. Masalahnya, fitur bawaan itu hanya memotong gambar mentah
            tanpa template kreatif, tanpa generator teks otomatis, dan tidak
            bisa dipakai di grup lewat perintah cepat.
          </p>
          <p className="text-sm leading-relaxed text-[#3B3934] sm:text-base">
            Kami membangun <strong>AmbaBot Studio</strong> sebagai project
            Capstone fullstack dengan satu mesin olah gambar bersama (
            <code className="border border-[#161614]/30 bg-[#EFE7D8] px-1.5 py-0.5 font-mono text-xs">
              Sharp + SVG + Gemini Vision
            </code>
            ) yang melayani browser dan WhatsApp secara bersamaan, lengkap
            dengan panel monitoring admin secara real-time.
          </p>

          <div className="grid grid-cols-3 gap-3 pt-2">
            <div className="zine-card-sm p-3">
              <p className="font-display text-2xl font-bold">5</p>
              <p className="font-mono text-[10px] uppercase text-[#5C584F]">
                Mode Stiker
              </p>
            </div>
            <div className="zine-card-sm bg-[#FFD646] p-3">
              <p className="font-display text-2xl font-bold">&lt;100KB</p>
              <p className="font-mono text-[10px] uppercase text-[#161614]">
                Auto Kompres
              </p>
            </div>
            <div className="zine-card-sm p-3">
              <p className="font-display text-2xl font-bold">0 Rp</p>
              <p className="font-mono text-[10px] uppercase text-[#5C584F]">
                Gratis Dipakai
              </p>
            </div>
          </div>
        </div>

        {/* Kanan: Lembar Spesifikasi Perbandingan (Gaya Struk / Spec Sheet) */}
        <div className="lg:col-span-6">
          <div className="zine-card p-5 sm:p-6">
            <div className="mb-4 flex items-center justify-between border-b-2 border-[#161614] pb-3">
              <div>
                <p className="font-mono text-[10px] font-bold uppercase tracking-wider text-[#5C584F]">
                  SPEC SHEET // PERBANDINGAN
                </p>
                <h3 className="font-display text-lg font-bold">
                  Stiker Bawaan WA vs AmbaBot Studio
                </h3>
              </div>
              <span className="border-2 border-[#161614] bg-[#B9F32B] px-2 py-0.5 font-mono text-[10px] font-bold">
                V3.0
              </span>
            </div>

            <div className="divide-y divide-[#161614]/20 text-xs sm:text-sm">
              <div className="grid grid-cols-12 pb-2 font-mono text-[10px] font-bold uppercase text-[#5C584F]">
                <span className="col-span-8">Kemampuan</span>
                <span className="col-span-2 text-center">WA</span>
                <span className="col-span-2 text-center">AmbaBot</span>
              </div>

              {COMPARISON_ROWS.map((row) => (
                <div
                  key={row.feature}
                  className="grid grid-cols-12 items-center py-2.5"
                >
                  <span className="col-span-8 pr-2 font-medium text-[#161614]">
                    {row.feature}
                  </span>
                  <span className="col-span-2 flex justify-center">
                    {row.waNative ? (
                      <Check className="h-4 w-4 text-[#161614]" />
                    ) : (
                      <X className="h-4 w-4 text-[#9E988D]" />
                    )}
                  </span>
                  <span className="col-span-2 flex justify-center">
                    <span className="flex h-5 w-5 items-center justify-center border border-[#161614] bg-[#B9F32B]">
                      <Check className="h-3.5 w-3.5 text-[#161614]" />
                    </span>
                  </span>
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* ================================================================= */}
      {/* SECTION 02 — KATALOG 5 MODE STIKER (BENTO ZINE)                   */}
      {/* ================================================================= */}
      <section id="fitur" className="space-y-6 border-t-2 border-[#161614] pt-12">
        <div className="flex flex-col justify-between gap-3 sm:flex-row sm:items-end">
          <div>
            <p className="font-mono text-xs font-bold uppercase tracking-widest text-[#5C584F]">
              02 // KATALOG FITUR
            </p>
            <h2 className="mt-1 font-display text-3xl font-bold tracking-tight">
              Lima mode siap pakai, satu mesin.
            </h2>
          </div>
          <Link
            href="/studio"
            className="inline-flex w-fit items-center gap-1.5 font-mono text-xs font-bold uppercase underline decoration-2 underline-offset-4 hover:text-[#3B3934]"
          >
            <span>Buka Semua di Web Studio</span>
            <ArrowRight className="h-3.5 w-3.5" />
          </Link>
        </div>

        <div className="grid gap-5 lg:grid-cols-12">
          {STICKER_MODES.map((item) => (
            <div
              key={item.num}
              className={`zine-card flex flex-col justify-between p-5 transition-transform hover:-translate-y-0.5 ${item.span}`}
            >
              <div className="space-y-3">
                <div className="flex items-center justify-between gap-2">
                  <span className="font-mono text-lg font-bold text-[#161614]">
                    {item.num}.
                  </span>
                  <span
                    className={`border-2 border-[#161614] px-2 py-0.5 font-mono text-[10px] font-bold uppercase ${item.tagBg}`}
                  >
                    {item.tag}
                  </span>
                </div>

                <h3 className="font-display text-xl font-bold tracking-tight">
                  {item.title}
                </h3>

                <p className="text-sm leading-relaxed text-[#45433D]">
                  {item.desc}
                </p>
              </div>

              <div className="mt-5 flex items-end justify-between gap-3 border-t-2 border-dashed border-[#161614]/25 pt-4">
                <div className="flex flex-wrap gap-1.5">
                  {item.cmd.map((c) => (
                    <code
                      key={c}
                      className="border border-[#161614] bg-[#161614] px-2 py-0.5 font-mono text-[11px] text-[#B9F32B]"
                    >
                      {c}
                    </code>
                  ))}
                </div>

                <Link
                  href={`/studio?mode=${item.tab}`}
                  className="inline-flex shrink-0 items-center gap-1 font-mono text-xs font-bold uppercase text-[#161614] hover:underline"
                >
                  <span>Coba</span>
                  <ArrowUpRight className="h-3.5 w-3.5" />
                </Link>
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* ================================================================= */}
      {/* SECTION 03 — DUA JALUR PAKAI (WEB STUDIO VS BOT WHATSAPP)         */}
      {/* ================================================================= */}
      <section
        id="cara-pakai"
        className="space-y-6 border-t-2 border-[#161614] pt-12"
      >
        <div>
          <p className="font-mono text-xs font-bold uppercase tracking-widest text-[#5C584F]">
            03 // CARA PAKAI
          </p>
          <h2 className="mt-1 font-display text-3xl font-bold tracking-tight">
            Pilih jalur yang paling cepat buat kamu.
          </h2>
        </div>

        <div className="grid gap-6 md:grid-cols-2">
          {/* Jalur 1: Web Studio */}
          <div className="zine-card flex flex-col justify-between p-6">
            <div className="space-y-4">
              <div className="inline-block border-2 border-[#161614] bg-[#B9F32B] px-2.5 py-1 font-mono text-xs font-bold uppercase">
                JALUR A • LEWAT BROWSER
              </div>
              <h3 className="font-display text-2xl font-bold">
                Web Sticker Studio
              </h3>
              <ol className="space-y-2.5 text-sm text-[#3B3934]">
                <li className="flex gap-2.5">
                  <span className="font-mono font-bold text-[#161614]">1.</span>
                  <span>
                    Buka halaman <strong>Studio</strong> langsung dari HP atau
                    laptop tanpa login.
                  </span>
                </li>
                <li className="flex gap-2.5">
                  <span className="font-mono font-bold text-[#161614]">2.</span>
                  <span>
                    Pilih salah satu dari 5 mode, unggah foto atau ketik teks.
                  </span>
                </li>
                <li className="flex gap-2.5">
                  <span className="font-mono font-bold text-[#161614]">3.</span>
                  <span>
                    Cek hasil preview transparan 512×512 lalu klik{" "}
                    <strong>Download (.webp)</strong>.
                  </span>
                </li>
              </ol>
            </div>

            <div className="mt-6 pt-2">
              <Link
                href="/studio"
                className="zine-btn inline-flex w-full items-center justify-center gap-2 bg-[#B9F32B] px-5 py-3 font-display text-sm font-bold text-[#161614]"
              >
                <span>Buka Web Studio</span>
                <ArrowRight className="h-4 w-4" />
              </Link>
            </div>
          </div>

          {/* Jalur 2: WhatsApp Bot */}
          <div className="zine-card flex flex-col justify-between bg-[#161614] p-6 text-[#F5F0E6]">
            <div className="space-y-4">
              <div className="inline-flex items-center gap-1.5 border-2 border-[#B9F32B] bg-transparent px-2.5 py-1 font-mono text-xs font-bold uppercase text-[#B9F32B]">
                <Terminal className="h-3.5 w-3.5" />
                <span>JALUR B • LANGSUNG DI WHATSAPP</span>
              </div>
              <h3 className="font-display text-2xl font-bold text-[#FFFDF7]">
                Bot WhatsApp ({WA_BOT_DISPLAY})
              </h3>
              <ol className="space-y-2.5 text-sm text-[#D6CFC2]">
                <li className="flex gap-2.5">
                  <span className="font-mono font-bold text-[#B9F32B]">1.</span>
                  <span>
                    Klik tombol chat di bawah atau invite nomor bot ke{" "}
                    <strong className="text-white">Grup WA</strong>.
                  </span>
                </li>
                <li className="flex gap-2.5">
                  <span className="font-mono font-bold text-[#B9F32B]">2.</span>
                  <span>
                    Kirim foto dengan caption{" "}
                    <code className="text-[#FFD646]">/stiker</code>,{" "}
                    <code className="text-[#FFD646]">/aimeme</code>,{" "}
                    <code className="text-[#FFD646]">/news</code>, atau kirim
                    teks <code className="text-[#FFD646]">/qc</code> &amp;{" "}
                    <code className="text-[#FFD646]">/brat</code>.
                  </span>
                </li>
                <li className="flex gap-2.5">
                  <span className="font-mono font-bold text-[#B9F32B]">3.</span>
                  <span>
                    Bot otomatis membalas stiker jadi yang siap langsung
                    disimpan ke Favorit WA.
                  </span>
                </li>
              </ol>
            </div>

            <div className="mt-6 pt-2">
              <a
                href={WA_BOT_LINK}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex w-full items-center justify-center gap-2 border-2 border-[#B9F32B] bg-[#B9F32B] px-5 py-3 font-display text-sm font-bold text-[#161614] transition-transform hover:-translate-y-0.5"
              >
                <MessageCircle className="h-4 w-4" />
                <span>Chat Bot Sekarang</span>
                <ArrowUpRight className="h-4 w-4" />
              </a>
            </div>
          </div>
        </div>
      </section>

      {/* ================================================================= */}
      {/* SECTION 04 — CLOSING CTA BANNER                                   */}
      {/* ================================================================= */}
      <section className="border-2 border-[#161614] bg-[#FFD646] p-6 shadow-[6px_6px_0_#161614] sm:p-10">
        <div className="flex flex-col items-start justify-between gap-6 md:flex-row md:items-center">
          <div className="max-w-xl space-y-2">
            <p className="font-mono text-xs font-bold uppercase tracking-wider text-[#161614]">
              SIAP NYOBAIN LANGSUNG?
            </p>
            <h2 className="font-display text-2xl font-bold tracking-tight text-[#161614] sm:text-3xl">
              Nggak perlu daftar akun, nggak perlu install aplikasi.
            </h2>
            <p className="text-sm text-[#2B2925]">
              Buka Web Studio untuk bikin stiker pertama kamu dalam hitungan
              detik, atau langsung sapa bot kami di WhatsApp.
            </p>
          </div>

          <div className="flex flex-wrap gap-3">
            <Link
              href="/studio"
              className="zine-btn inline-flex items-center gap-2 bg-[#161614] px-6 py-3.5 font-display text-sm font-bold text-[#F5F0E6]"
            >
              <span>Mulai di Web Studio</span>
              <ArrowRight className="h-4 w-4" />
            </Link>
            <a
              href={WA_BOT_LINK}
              target="_blank"
              rel="noopener noreferrer"
              className="zine-btn inline-flex items-center gap-2 bg-[#FFFDF7] px-5 py-3.5 font-display text-sm font-bold text-[#161614]"
            >
              <span>Buka WA Bot</span>
              <ArrowUpRight className="h-4 w-4" />
            </a>
          </div>
        </div>
      </section>
    </div>
  );
}
