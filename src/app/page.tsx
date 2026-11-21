import {
  Sparkles,
  MessageCircle,
  Image as ImageIcon,
  MessageSquareQuote,
  Type,
  Tv,
  CheckCircle2,
} from "lucide-react";
import StickerUploader from "@/components/StickerUploader";

const WA_COMMANDS = [
  {
    icon: ImageIcon,
    badge: "Foto",
    title: "Standard & Smart Crop",
    commands: ["/stiker (atau tanpa caption)", "/crop"],
    desc: "Ubah foto jadi stiker WebP 512x512 transparan utuh (contain) atau kotak penuh 1:1 (cover).",
  },
  {
    icon: Sparkles,
    badge: "AI Vision",
    title: "AI Auto-Meme & Roast",
    commands: ["/aimeme", "/roast"],
    desc: "Kirim foto dengan caption ini agar Gemini Vision otomatis menganalisis foto dan membuat caption meme/roast lucu.",
  },
  {
    icon: MessageSquareQuote,
    badge: "Teks Saja",
    title: "Fake Chat Bubble",
    commands: ["/qc Besok bimbingan jam 8!"],
    desc: "Ketik teks tanpa foto untuk langsung merender stiker bubble chat WA Dark Mode lengkap dengan jam WIB & centang biru.",
  },
  {
    icon: Type,
    badge: "Teks Saja",
    title: "Brat Typography",
    commands: ["/brat lagi pusing revisi bab 4"],
    desc: "Ubah teks menjadi stiker tipografi viral berlatar hijau khas Brat (#8ACE00) dengan efek low-fi blur.",
  },
  {
    icon: Tv,
    badge: "Foto + Teks",
    title: "LIVE Breaking News",
    commands: ["/news Mahasiswa Belum Tidur 2 Hari"],
    desc: "Bingkai fotomu otomatis dengan overlay siaran TV LIVE Breaking News, headline berita, dan ticker jam siaran.",
  },
  {
    icon: MessageCircle,
    badge: "Foto + Teks",
    title: "Classic Meme Generator",
    commands: ["/stiker Teks Atas | Teks Bawah"],
    desc: "Tambahkan teks kapital tebal putih dengan garis tepi hitam ala meme klasik menggunakan pemisah tanda |.",
  },
];

export default function HomePage() {
  return (
    <div className="space-y-10">
      {/* Hero Header */}
      <section className="flex flex-col justify-between gap-4 sm:flex-row sm:items-end">
        <div className="max-w-2xl space-y-2.5">
          <div className="inline-flex items-center gap-1.5 rounded-full border border-emerald-200 bg-emerald-50 px-3 py-1 text-xs font-semibold text-emerald-700">
            <CheckCircle2 className="h-3.5 w-3.5" />
            <span>512×512 WebP Otomatis &lt; 100 KB • Dual-Channel WA & Web</span>
          </div>
          <h1 className="text-2xl font-extrabold tracking-tight text-slate-900 sm:text-3xl">
            AI-Powered & Template Sticker Studio
          </h1>
          <p className="text-sm leading-relaxed text-slate-600 sm:text-base">
            Buat stiker WhatsApp langsung dari browser atau kirim pesan ke Bot WhatsApp.
            Mendukung AI Vision Auto-Meme, Fake Chat Bubble, Brat Text, hingga frame LIVE Breaking News.
          </p>
        </div>
      </section>

      {/* Interactive 5-Mode Studio */}
      <section>
        <StickerUploader />
      </section>

      {/* Panduan Perintah Bot WhatsApp */}
      <section className="space-y-4">
        <div className="flex flex-col gap-1 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h2 className="text-lg font-bold text-slate-900">
              Panduan Perintah Bot WhatsApp
            </h2>
            <p className="text-sm text-slate-500">
              Semua mode di atas juga aktif otomatis di WhatsApp Bot menggunakan engine pemrosesan yang sama.
            </p>
          </div>
          <span className="inline-flex w-fit items-center gap-1.5 rounded-lg bg-slate-200/70 px-3 py-1 text-xs font-mono font-semibold text-slate-700">
            Ketik /help di chat WA untuk daftar menu
          </span>
        </div>

        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {WA_COMMANDS.map((item) => {
            const Icon = item.icon;
            return (
              <div
                key={item.title}
                className="flex flex-col justify-between rounded-2xl border border-slate-200 bg-white p-4 shadow-xs"
              >
                <div className="space-y-2.5">
                  <div className="flex items-center justify-between">
                    <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-slate-100 text-slate-700">
                      <Icon className="h-4 w-4" />
                    </div>
                    <span className="rounded-full bg-slate-100 px-2.5 py-0.5 text-[11px] font-semibold text-slate-600">
                      {item.badge}
                    </span>
                  </div>
                  <h3 className="text-sm font-bold text-slate-900">{item.title}</h3>
                  <p className="text-xs leading-relaxed text-slate-600">{item.desc}</p>
                </div>

                <div className="mt-4 flex flex-wrap gap-1.5 border-t border-slate-100 pt-3">
                  {item.commands.map((cmd) => (
                    <code
                      key={cmd}
                      className="rounded-md bg-slate-900 px-2 py-1 font-mono text-[11px] text-emerald-300"
                    >
                      {cmd}
                    </code>
                  ))}
                </div>
              </div>
            );
          })}
        </div>
      </section>
    </div>
  );
}