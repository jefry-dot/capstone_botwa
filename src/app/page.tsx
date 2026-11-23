import Link from "next/link";
import {
  ArrowRight,
  ArrowUpRight,
  Check,
  X,
  MessageCircle,
  Sparkles,
  Crown,
  Link2,
} from "lucide-react";

const WA_BOT_NUMBER =
  process.env.NEXT_PUBLIC_WA_BOT_NUMBER || "6285959632681";
const WA_BOT_DISPLAY = "+62 859-5963-2681";

function buildWaLink(prefillText: string) {
  return `https://wa.me/${WA_BOT_NUMBER}?text=${encodeURIComponent(
    prefillText
  )}`;
}

const STICKER_MODES = [
  {
    num: "01",
    tag: "AI VISION",
    tagBg: "bg-[#FFD646]",
    title: "AI Auto-Meme & Roast",
    cmd: ["/aimeme", "/roast"],
    prefill: "/help",
    desc: "Kirim atau reply foto di WhatsApp dengan caption ini. Gemini Vision membaca isi foto lalu menulis punchline komedi atau roasting kampus otomatis.",
    span: "lg:col-span-7",
  },
  {
    num: "02",
    tag: "TANPA FOTO",
    tagBg: "bg-[#B9F32B]",
    title: "Fake Quote Chat Bubble",
    cmd: ["/qc Besok bimbingan jam 8!"],
    prefill: "/qc Besok bimbingan jam 8 jangan telat!",
    desc: "Cukup ketik teks atau reply chat teman di grup WA. Langsung jadi stiker bubble WhatsApp Dark Mode lengkap dengan avatar inisial, jam WIB, dan centang biru.",
    span: "lg:col-span-5",
  },
  {
    num: "03",
    tag: "TIPOGRAFI",
    tagBg: "bg-[#B9F32B]",
    title: "Brat Typography Press",
    cmd: ["/brat lagi pusing revisi bab 4"],
    prefill: "/brat lagi pusing revisi bab 4",
    desc: "Ubah curhatan singkat jadi stiker kotak hijau #8ACE00 bergaya low-fi blur yang super ringan di bawah 10 KB.",
    span: "lg:col-span-4",
  },
  {
    num: "04",
    tag: "FRAME TV",
    tagBg: "bg-[#EB3B2E] text-white",
    title: "LIVE Breaking News",
    cmd: ["/news Mahasiswa Belum Tidur 2 Hari"],
    prefill: "/help",
    desc: "Kirim foto dengan caption /news agar fotomu otomatis masuk bingkai siaran TV lengkap dengan badge LIVE merah dan jam WIB.",
    span: "lg:col-span-4",
  },
  {
    num: "05",
    tag: "FOTO & MEME",
    tagBg: "bg-[#EFE7D8]",
    title: "Standard, Crop & Meme Klasik",
    cmd: ["/stiker", "/crop", "/stiker Atas | Bawah"],
    prefill: "/help",
    desc: "Konversi foto presisi 512×512 WebP di bawah 100 KB — utuh transparan (contain), kotak penuh (cover), maupun teks meme tebal.",
    span: "lg:col-span-4",
  },
];

const COMPARISON_ROWS = [
  { feature: "Potong foto jadi stiker polos", waNative: true, ambabot: true },
  {
    feature: "AI baca foto & karang teks meme / roast",
    waNative: false,
    ambabot: true,
  },
  {
    feature: "Stiker bubble chat WA (/qc) dari teks / reply",
    waNative: false,
    ambabot: true,
  },
  {
    feature: "Bingkai LIVE Breaking News & teks Brat",
    waNative: false,
    ambabot: true,
  },
  {
    feature: "Jalan otomatis di Grup WA & DM tanpa spam",
    waNative: false,
    ambabot: true,
  },
  {
    feature: "Custom Nama Pack & Author EXIF (Pro Creator)",
    waNative: false,
    ambabot: true,
  },
];

export default function CompanyProfilePage() {
  return (
    <div className="space-y-16 pb-6 sm:space-y-20">
      {/* ================================================================= */}
      {/* HERO SECTION — WHATSAPP-FIRST STICKER ZINE                        */}
      {/* ================================================================= */}
      <section className="grid items-center gap-10 lg:grid-cols-12">
        <div className="space-y-6 lg:col-span-7">
          <div className="inline-flex items-center gap-2 border-2 border-[#161614] bg-[#FFD646] px-3 py-1 font-mono text-xs font-bold uppercase tracking-wider shadow-[2px_2px_0_#161614]">
            <span>BOT STIKER WHATSAPP AI</span>
            <span>•</span>
            <span>DM &amp; GRUP WA</span>
          </div>

          <h1 className="font-display text-4xl leading-[1.05] font-bold tracking-tight text-[#161614] sm:text-5xl lg:text-[54px]">
            Bikin stiker WA yang{" "}
            <span className="relative inline-block">
              <span className="relative z-10">nggak pasaran,</span>
              <span
                aria-hidden="true"
                className="absolute right-0 bottom-1 left-0 z-0 h-3.5 -rotate-1 bg-[#B9F32B]"
              />
            </span>{" "}
            langsung dari chat.
          </h1>

          <p className="max-w-xl text-base leading-relaxed text-[#3B3934] sm:text-lg">
            Cukup kirim foto atau ketik perintah ke Bot WhatsApp{" "}
            <strong>AmbaBot Studio ({WA_BOT_DISPLAY})</strong>. Mau kuota AI
            50x/hari &amp; ganti nama pack stiker pakai namamu sendiri? Tinggal
            daftar akun di sini lalu tautkan ke WA pakai{" "}
            <code className="border border-[#161614]/30 bg-[#EFE7D8] px-1.5 py-0.5 font-mono text-sm font-bold">
              /link
            </code>
            .
          </p>

          {/* 2 Pilihan Aksi Utama */}
          <div className="flex flex-wrap items-center gap-3.5 pt-1">
            <a
              href={buildWaLink("/help")}
              target="_blank"
              rel="noopener noreferrer"
              className="zine-btn inline-flex items-center gap-2.5 bg-[#B9F32B] px-6 py-3.5 font-display text-sm font-bold text-[#161614] sm:text-base"
            >
              <MessageCircle className="h-4 w-4" />
              <span>Chat Bot WhatsApp Sekarang</span>
              <ArrowUpRight className="h-4 w-4" />
            </a>

            <Link
              href="/register"
              className="zine-btn inline-flex items-center gap-2 bg-[#FFFDF7] px-5 py-3.5 font-display text-sm font-bold text-[#161614] sm:text-base"
            >
              <Crown className="h-4 w-4" />
              <span>Daftar Akun &amp; Upgrade Pro</span>
              <ArrowRight className="h-4 w-4" />
            </Link>
          </div>

          <div className="flex flex-wrap gap-x-6 gap-y-2 border-t-2 border-dashed border-[#161614]/30 pt-4 font-mono text-xs text-[#45433D]">
            <span>• Langsung Pakai Gratis di WA</span>
            <span>• Custom Pack EXIF untuk Pro</span>
            <span>• Daftar Web Tanpa Verifikasi Email</span>
          </div>
        </div>

        {/* Kanan: Papan Kolase Stiker Tempelan */}
        <div className="lg:col-span-5">
          <div className="relative border-2 border-[#161614] bg-[#EFE7D8] p-5 shadow-[6px_6px_0_#161614] sm:p-6">
            <div
              aria-hidden="true"
              className="absolute -top-3 left-1/2 h-6 w-24 -translate-x-1/2 -rotate-2 border border-[#161614]/30 bg-[#FFD646]/85"
            />

            <div className="mb-4 flex items-center justify-between font-mono text-[10px] font-bold uppercase tracking-wider text-[#5C584F]">
              <span>HASIL CETAK BOT WA // 512PX</span>
              <span>PACK EXIF AKTIF</span>
            </div>

            <div className="grid grid-cols-2 gap-3.5">
              {/* Mockup 1: Quote Bubble */}
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
                  <span>PACK: STIKER KAMU (PRO)</span>
                </div>
              </div>

              {/* Mockup 2: Brat */}
              <div className="rotate-2 border-2 border-[#161614] bg-[#8ACE00] p-3.5 shadow-[3px_3px_0_#161614]">
                <div className="flex aspect-square flex-col items-center justify-center text-center">
                  <p className="font-sans text-lg leading-tight font-medium tracking-tight text-[#111] blur-[0.4px]">
                    lagi pusing revisi bab 4
                  </p>
                </div>
                <p className="mt-1.5 border-t border-[#161614]/25 pt-1 font-mono text-[9px] font-bold text-[#161614]">
                  /brat • 5.9 KB
                </p>
              </div>

              {/* Mockup 3: Breaking News */}
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
                  /news • 12.2 KB
                </p>
              </div>
            </div>

            <div className="mt-3.5 flex items-center justify-between border-2 border-[#161614] bg-[#161614] px-3 py-2 text-[#F5F0E6]">
              <div className="flex items-center gap-2 font-mono text-[11px]">
                <Sparkles className="h-3.5 w-3.5 text-[#B9F32B]" />
                <span>+ AI Vision (/aimeme &amp; /roast)</span>
              </div>
              <Link
                href="/#harga"
                className="font-mono text-[11px] font-bold text-[#FFD646] hover:underline"
              >
                Lihat Paket →
              </Link>
            </div>
          </div>
        </div>
      </section>

      {/* ================================================================= */}
      {/* SECTION 01 — TENTANG STUDIO & PERBANDINGAN                        */}
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
            Fitur bawaan WhatsApp hanya bisa memotong foto polos.{" "}
            <strong>AmbaBot Studio</strong> menghadirkan mesin stiker otomatis
            langsung di chat WhatsApp dengan AI Vision, template viral, dan
            portal akun web untuk mengatur nama pack stiker sendiri.
          </p>
          <p className="text-sm leading-relaxed text-[#3B3934] sm:text-base">
            Pengguna cukup chat bot di DM atau grup untuk membuat stiker,
            sementara portal web berfungsi sebagai pusat manajemen paket Pro,
            tautan nomor WA (<code className="font-mono font-bold">/link</code>
            ), custom branding EXIF, dan riwayat pemakaian pribadi.
          </p>

          <div className="grid grid-cols-3 gap-3 pt-2">
            <div className="zine-card-sm p-3">
              <p className="font-display text-2xl font-bold">5</p>
              <p className="font-mono text-[10px] uppercase text-[#5C584F]">
                Mode Perintah
              </p>
            </div>
            <div className="zine-card-sm bg-[#FFD646] p-3">
              <p className="font-display text-2xl font-bold">50x</p>
              <p className="font-mono text-[10px] uppercase text-[#161614]">
                Kuota AI Pro
              </p>
            </div>
            <div className="zine-card-sm p-3">
              <p className="font-display text-2xl font-bold">&lt;100KB</p>
              <p className="font-mono text-[10px] uppercase text-[#5C584F]">
                EXIF WebP
              </p>
            </div>
          </div>
        </div>

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
                V4.0
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
      {/* SECTION 02 — KATALOG 5 MODE PERINTAH WHATSAPP                     */}
      {/* ================================================================= */}
      <section id="fitur" className="space-y-6 border-t-2 border-[#161614] pt-12">
        <div className="flex flex-col justify-between gap-3 sm:flex-row sm:items-end">
          <div>
            <p className="font-mono text-xs font-bold uppercase tracking-widest text-[#5C584F]">
              02 // KATALOG PERINTAH BOT WHATSAPP
            </p>
            <h2 className="mt-1 font-display text-3xl font-bold tracking-tight">
              Cukup kirim perintah di chat, stiker langsung jadi.
            </h2>
          </div>
          <a
            href={buildWaLink("/help")}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex w-fit items-center gap-1.5 font-mono text-xs font-bold uppercase underline decoration-2 underline-offset-4 hover:text-[#3B3934]"
          >
            <span>Coba /help di WhatsApp</span>
            <ArrowUpRight className="h-3.5 w-3.5" />
          </a>
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

                <a
                  href={buildWaLink(item.prefill)}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex shrink-0 items-center gap-1 font-mono text-xs font-bold uppercase text-[#161614] hover:underline"
                >
                  <span>Coba WA</span>
                  <ArrowUpRight className="h-3.5 w-3.5" />
                </a>
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* ================================================================= */}
      {/* SECTION 03 — CARA KERJA (WA BOT <-> PORTAL AKUN WEB)              */}
      {/* ================================================================= */}
      <section
        id="cara-pakai"
        className="space-y-6 border-t-2 border-[#161614] pt-12"
      >
        <div>
          <p className="font-mono text-xs font-bold uppercase tracking-widest text-[#5C584F]">
            03 // CARA PAKAI &amp; TAUTAN PRO
          </p>
          <h2 className="mt-1 font-display text-3xl font-bold tracking-tight">
            Bikin stiker di WA, atur fitur Pro dari Web.
          </h2>
        </div>

        <div className="grid gap-5 md:grid-cols-3">
          <div className="zine-card p-5">
            <span className="inline-block border-2 border-[#161614] bg-[#B9F32B] px-2 py-0.5 font-mono text-xs font-bold">
              LANGKAH 01
            </span>
            <h3 className="mt-3 font-display text-lg font-bold">
              Chat Bot WhatsApp
            </h3>
            <p className="mt-2 text-sm leading-relaxed text-[#45433D]">
              Simpan atau klik nomor bot <strong>{WA_BOT_DISPLAY}</strong> (bisa
              di DM atau invite ke Grup WA). Kirim perintah{" "}
              <code className="font-mono font-bold">/stiker</code>,{" "}
              <code className="font-mono font-bold">/aimeme</code>,{" "}
              <code className="font-mono font-bold">/qc</code>, atau{" "}
              <code className="font-mono font-bold">/brat</code>.
            </p>
          </div>

          <div className="zine-card p-5">
            <span className="inline-block border-2 border-[#161614] bg-[#FFD646] px-2 py-0.5 font-mono text-xs font-bold">
              LANGKAH 02
            </span>
            <h3 className="mt-3 font-display text-lg font-bold">
              Daftar Akun &amp; Tautkan WA
            </h3>
            <p className="mt-2 text-sm leading-relaxed text-[#45433D]">
              Buat akun cepat di website (langsung aktif tanpa verifikasi
              email), klik <strong>Tautkan WA</strong> di Dashboard Akun untuk
              mendapat kode 6 digit, lalu kirim{" "}
              <code className="font-mono font-bold">/link 123456</code> ke Bot
              WA.
            </p>
          </div>

          <div className="zine-card bg-[#161614] p-5 text-[#F5F0E6]">
            <span className="inline-flex items-center gap-1 border-2 border-[#B9F32B] px-2 py-0.5 font-mono text-xs font-bold text-[#B9F32B]">
              <Link2 className="h-3 w-3" />
              LANGKAH 03
            </span>
            <h3 className="mt-3 font-display text-lg font-bold text-[#FFFDF7]">
              Aktifkan Pro &amp; Custom EXIF
            </h3>
            <p className="mt-2 text-sm leading-relaxed text-[#D6CFC2]">
              Upgrade ke <strong className="text-[#FFD646]">Pro Creator</strong>{" "}
              (bisa pakai kode voucher demo{" "}
              <code className="font-mono text-[#B9F32B]">CAPSTONEPRO</code>)
              untuk membuka kuota AI 50x/hari &amp; memasang nama pack stiker
              milikmu sendiri!
            </p>
          </div>
        </div>
      </section>

      {/* ================================================================= */}
      {/* SECTION 04 — PRICING / SKEMA FREEMIUM VS PRO CREATOR              */}
      {/* ================================================================= */}
      <section
        id="harga"
        className="space-y-6 border-t-2 border-[#161614] pt-12"
      >
        <div className="flex flex-col justify-between gap-3 sm:flex-row sm:items-end">
          <div>
            <p className="font-mono text-xs font-bold uppercase tracking-widest text-[#5C584F]">
              04 // PAKET &amp; SKEMA PREMIUM
            </p>
            <h2 className="mt-1 font-display text-3xl font-bold tracking-tight">
              Gratis buat mulai, Pro buat branding sendiri.
            </h2>
          </div>
          <span className="w-fit border-2 border-[#161614] bg-[#EFE7D8] px-3 py-1 font-mono text-xs font-bold text-[#161614]">
            VOUCHER DEMO SIDANG: CAPSTONEPRO
          </span>
        </div>

        <div className="grid gap-6 lg:grid-cols-3">
          {/* Tier 1: Gratis */}
          <div className="zine-card flex flex-col justify-between p-6">
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <span className="border-2 border-[#161614] bg-[#EFE7D8] px-2.5 py-0.5 font-mono text-xs font-bold uppercase">
                  FREE TIER
                </span>
                <span className="font-mono text-xs text-[#5C584F]">
                  Tanpa Daftar
                </span>
              </div>
              <div>
                <p className="font-display text-3xl font-bold">Rp 0</p>
                <p className="font-mono text-xs text-[#5C584F]">
                  Gratis selamanya di WhatsApp
                </p>
              </div>
              <ul className="space-y-2.5 border-t-2 border-dashed border-[#161614]/20 pt-4 text-sm text-[#3B3934]">
                <li className="flex items-start gap-2">
                  <Check className="mt-0.5 h-4 w-4 shrink-0 text-[#161614]" />
                  <span>
                    Unlimited stiker <code className="font-mono">/stiker</code>,{" "}
                    <code className="font-mono">/crop</code>,{" "}
                    <code className="font-mono">/qc</code>,{" "}
                    <code className="font-mono">/brat</code>,{" "}
                    <code className="font-mono">/news</code>
                  </span>
                </li>
                <li className="flex items-start gap-2">
                  <Check className="mt-0.5 h-4 w-4 shrink-0 text-[#161614]" />
                  <span>Kuota AI Vision 10x / hari di WhatsApp</span>
                </li>
                <li className="flex items-start gap-2">
                  <Check className="mt-0.5 h-4 w-4 shrink-0 text-[#161614]" />
                  <span>Bisa dipakai di DM maupun Grup WA</span>
                </li>
                <li className="flex items-start gap-2 text-[#8E897E]">
                  <X className="mt-0.5 h-4 w-4 shrink-0" />
                  <span>Watermark Pack EXIF bawaan (AmbaBot Studio)</span>
                </li>
              </ul>
            </div>

            <a
              href={buildWaLink("/help")}
              target="_blank"
              rel="noopener noreferrer"
              className="zine-btn mt-6 inline-flex w-full items-center justify-center gap-2 bg-[#FFFDF7] px-4 py-3 font-display text-sm font-bold text-[#161614]"
            >
              <span>Langsung Chat Bot WA</span>
              <ArrowUpRight className="h-4 w-4" />
            </a>
          </div>

          {/* Tier 2: Pro Creator (Highlighted) */}
          <div className="zine-card relative flex flex-col justify-between bg-[#FFD646] p-6 shadow-[6px_6px_0_#161614]">
            <div className="absolute -top-3.5 right-4 border-2 border-[#161614] bg-[#B9F32B] px-3 py-0.5 font-mono text-[10px] font-bold uppercase shadow-[2px_2px_0_#161614]">
              PALING POPULER
            </div>

            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <span className="inline-flex items-center gap-1 border-2 border-[#161614] bg-[#161614] px-2.5 py-0.5 font-mono text-xs font-bold uppercase text-[#B9F32B]">
                  <Crown className="h-3 w-3" />
                  PRO CREATOR
                </span>
                <span className="font-mono text-xs font-bold text-[#161614]">
                  30 Hari
                </span>
              </div>
              <div>
                <p className="font-display text-3xl font-bold text-[#161614]">
                  Rp 15.000
                  <span className="font-mono text-xs font-medium"> /bln</span>
                </p>
                <p className="font-mono text-xs text-[#2B2925]">
                  Bisa dites gratis via Simulasi QRIS / Voucher Demo
                </p>
              </div>
              <ul className="space-y-2.5 border-t-2 border-dashed border-[#161614]/30 pt-4 text-sm font-medium text-[#161614]">
                <li className="flex items-start gap-2">
                  <Check className="mt-0.5 h-4 w-4 shrink-0" />
                  <span>Semua fitur Free Tier tanpa batasan</span>
                </li>
                <li className="flex items-start gap-2">
                  <Check className="mt-0.5 h-4 w-4 shrink-0" />
                  <span>
                    <strong>Kuota AI Vision 50x / hari</strong> (/aimeme &amp;
                    /roast)
                  </span>
                </li>
                <li className="flex items-start gap-2">
                  <Check className="mt-0.5 h-4 w-4 shrink-0" />
                  <span>
                    <strong>Custom Nama Pack &amp; Author EXIF</strong> di
                    WhatsApp (tanpa watermark AmbaBot)
                  </span>
                </li>
                <li className="flex items-start gap-2">
                  <Check className="mt-0.5 h-4 w-4 shrink-0" />
                  <span>
                    <strong>User Dashboard (/account)</strong>: riwayat stiker
                    WA &amp; monitor kuota real-time
                  </span>
                </li>
              </ul>
            </div>

            <Link
              href="/register?plan=pro"
              className="zine-btn mt-6 inline-flex w-full items-center justify-center gap-2 bg-[#161614] px-4 py-3 font-display text-sm font-bold text-[#F5F0E6]"
            >
              <span>Daftar &amp; Aktifkan Pro</span>
              <ArrowRight className="h-4 w-4" />
            </Link>
          </div>

          {/* Tier 3: B2B Event / UMKM */}
          <div className="zine-card flex flex-col justify-between p-6">
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <span className="border-2 border-[#161614] bg-[#161614] px-2.5 py-0.5 font-mono text-xs font-bold uppercase text-white">
                  B2B EVENT / UMKM
                </span>
                <span className="font-mono text-xs text-[#5C584F]">
                  White-Label
                </span>
              </div>
              <div>
                <p className="font-display text-3xl font-bold">Rp 250rb</p>
                <p className="font-mono text-xs text-[#5C584F]">
                  Per event kampus / komunitas / brand
                </p>
              </div>
              <ul className="space-y-2.5 border-t-2 border-dashed border-[#161614]/20 pt-4 text-sm text-[#3B3934]">
                <li className="flex items-start gap-2">
                  <Check className="mt-0.5 h-4 w-4 shrink-0 text-[#161614]" />
                  <span>Bot dipasang di nomor WA resmi brand / event</span>
                </li>
                <li className="flex items-start gap-2">
                  <Check className="mt-0.5 h-4 w-4 shrink-0 text-[#161614]" />
                  <span>Frame /news &amp; EXIF Pack khusus logo acara</span>
                </li>
                <li className="flex items-start gap-2">
                  <Check className="mt-0.5 h-4 w-4 shrink-0 text-[#161614]" />
                  <span>Akses Dashboard Analitik &amp; Export CSV peserta</span>
                </li>
                <li className="flex items-start gap-2">
                  <Check className="mt-0.5 h-4 w-4 shrink-0 text-[#161614]" />
                  <span>Kontrol kuota &amp; moderasi spam real-time</span>
                </li>
              </ul>
            </div>

            <a
              href={buildWaLink(
                "Halo tim AmbaBot Studio, saya tertarik paket B2B Event / White-Label Bot."
              )}
              target="_blank"
              rel="noopener noreferrer"
              className="zine-btn mt-6 inline-flex w-full items-center justify-center gap-2 bg-[#FFFDF7] px-4 py-3 font-display text-sm font-bold text-[#161614]"
            >
              <span>Konsultasi via WA</span>
              <ArrowUpRight className="h-4 w-4" />
            </a>
          </div>
        </div>
      </section>

      {/* ================================================================= */}
      {/* SECTION 05 — CLOSING CTA BANNER                                   */}
      {/* ================================================================= */}
      <section className="border-2 border-[#161614] bg-[#B9F32B] p-6 shadow-[6px_6px_0_#161614] sm:p-10">
        <div className="flex flex-col items-start justify-between gap-6 md:flex-row md:items-center">
          <div className="max-w-xl space-y-2">
            <p className="font-mono text-xs font-bold uppercase tracking-wider text-[#161614]">
              COBA SEKARANG JUGA
            </p>
            <h2 className="font-display text-2xl font-bold tracking-tight text-[#161614] sm:text-3xl">
              Chat botnya sekarang, rasakan bedanya dalam 5 detik.
            </h2>
            <p className="text-sm text-[#161614]/85">
              Ketik <code className="font-mono font-bold">/help</code> di
              WhatsApp untuk langsung mencoba gratis, atau buat akun web untuk
              membuka fitur Custom Pack EXIF Pro.
            </p>
          </div>

          <div className="flex flex-wrap gap-3">
            <a
              href={buildWaLink("/help")}
              target="_blank"
              rel="noopener noreferrer"
              className="zine-btn inline-flex items-center gap-2 bg-[#161614] px-6 py-3.5 font-display text-sm font-bold text-[#F5F0E6]"
            >
              <MessageCircle className="h-4 w-4" />
              <span>Buka Bot WhatsApp</span>
              <ArrowUpRight className="h-4 w-4" />
            </a>
            <Link
              href="/register"
              className="zine-btn inline-flex items-center gap-2 bg-[#FFFDF7] px-5 py-3.5 font-display text-sm font-bold text-[#161614]"
            >
              <span>Daftar Akun Web</span>
              <ArrowRight className="h-4 w-4" />
            </Link>
          </div>
        </div>
      </section>
    </div>
  );
}
