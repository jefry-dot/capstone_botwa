"use client";

import {
  useEffect,
  useRef,
  useState,
  type ChangeEvent,
  type DragEvent,
  type FormEvent,
} from "react";
import {
  Upload,
  Sparkles,
  MessageSquareQuote,
  Type,
  Tv,
  Image as ImageIcon,
  Download,
  Loader2,
  AlertCircle,
  Clock,
  HardDrive,
  RefreshCw,
} from "lucide-react";
import type { StickerCommandType } from "@/types/database";

export type StudioTab =
  | "photo"
  | "ai_meme"
  | "quote_chat"
  | "brat_text"
  | "breaking_news";
type PhotoSubMode = "standard" | "crop" | "meme_text";
type AiStyle = "aimeme" | "roast";

interface GeneratedSticker {
  url: string;
  sizeKb: string;
  processMs: string;
  commandType: string;
  aiCaption: string | null;
}

interface StickerUploaderProps {
  initialTab?: StudioTab;
}

const STUDIO_TABS: Array<{
  id: StudioTab;
  num: string;
  label: string;
  badge?: string;
  icon: typeof ImageIcon;
  needsImage: boolean;
}> = [
  { id: "photo", num: "01", label: "Foto & Meme", icon: ImageIcon, needsImage: true },
  {
    id: "ai_meme",
    num: "02",
    label: "AI Meme / Roast",
    badge: "AI",
    icon: Sparkles,
    needsImage: true,
  },
  {
    id: "quote_chat",
    num: "03",
    label: "Quote Chat",
    icon: MessageSquareQuote,
    needsImage: false,
  },
  { id: "brat_text", num: "04", label: "Brat Text", icon: Type, needsImage: false },
  {
    id: "breaking_news",
    num: "05",
    label: "Breaking News",
    icon: Tv,
    needsImage: true,
  },
];

const QUOTE_PRESETS = [
  { name: "Ketua Kelompok", text: "Besok bimbingan jam 8 pagi jangan telat!" },
  { name: "Dosen Pembimbing", text: "Revisi dikit aja kok, cuma ganti bab 1 sampai 5." },
  { name: "Anak Capstone", text: "Gas ngopi dulu baru ngerjain kodingan." },
];

const BRAT_PRESETS = [
  "lagi pusing revisi bab 4",
  "sidang capstone otw nilai a",
  "tidur cuma mitos",
];

const NEWS_PRESETS = [
  "MAHASISWA INI BELUM TIDUR 2 HARI DEMI CAPSTONE",
  "DOSEN PEMBIMBING BILANG ACC TANPA REVISI",
  "WARGA KAMPUS KEHABISAN KOPI JAM 2 PAGI",
];

const MEME_PRESETS = [
  { top: "KETIKA DOSEN BILANG", bottom: "REVISI DIKIT AJA KOK" },
  { top: "BARU BUKA LAPTOP", bottom: "EH UDAH JAM 3 PAGI" },
];

export default function StickerUploader({
  initialTab = "photo",
}: StickerUploaderProps) {
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  const [activeTab, setActiveTab] = useState<StudioTab>(initialTab);
  const [photoSubMode, setPhotoSubMode] = useState<PhotoSubMode>("standard");

  // State file gambar
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [isDragging, setIsDragging] = useState(false);

  // State input teks per mode
  const [topText, setTopText] = useState("");
  const [bottomText, setBottomText] = useState("");
  const [aiStyle, setAiStyle] = useState<AiStyle>("aimeme");
  const [quoteName, setQuoteName] = useState("Ketua Kelompok");
  const [quoteText, setQuoteText] = useState("");
  const [bratText, setBratText] = useState("");
  const [newsHeadline, setNewsHeadline] = useState("");

  // State hasil & request
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<GeneratedSticker | null>(null);

  const currentTabConfig = STUDIO_TABS.find((t) => t.id === activeTab)!;

  // Bersihkan Object URL agar tidak bocor memori di browser
  useEffect(() => {
    return () => {
      if (previewUrl) URL.revokeObjectURL(previewUrl);
    };
  }, [previewUrl]);

  useEffect(() => {
    return () => {
      if (result?.url) URL.revokeObjectURL(result.url);
    };
  }, [result]);

  function handleFileSelect(file: File | null) {
    if (!file) return;
    if (!file.type.startsWith("image/")) {
      setError("File harus berupa gambar (JPG, PNG, atau WebP).");
      return;
    }
    if (file.size > 5 * 1024 * 1024) {
      setError("Ukuran gambar maksimal 5 MB.");
      return;
    }

    setError(null);
    setSelectedFile(file);
    setPreviewUrl(URL.createObjectURL(file));
  }

  function onFileInputChange(e: ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0] ?? null;
    handleFileSelect(file);
  }

  function onDrop(e: DragEvent<HTMLDivElement>) {
    e.preventDefault();
    setIsDragging(false);
    const file = e.dataTransfer.files?.[0] ?? null;
    handleFileSelect(file);
  }

  function resolveCommandType(): StickerCommandType {
    if (activeTab === "photo") return photoSubMode;
    return activeTab;
  }

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);

    const commandType = resolveCommandType();

    if (currentTabConfig.needsImage && !selectedFile) {
      setError("Silakan pilih atau seret foto terlebih dahulu.");
      return;
    }
    if (commandType === "meme_text" && !topText.trim() && !bottomText.trim()) {
      setError("Isi minimal Teks Atas atau Teks Bawah untuk mode Meme Klasik.");
      return;
    }
    if (commandType === "quote_chat" && !quoteText.trim()) {
      setError("Isi pesan Quote Chat tidak boleh kosong.");
      return;
    }
    if (commandType === "brat_text" && !bratText.trim()) {
      setError("Teks Brat tidak boleh kosong.");
      return;
    }

    const formData = new FormData();
    formData.append("commandType", commandType);

    if (currentTabConfig.needsImage && selectedFile) {
      formData.append("file", selectedFile);
    }

    if (commandType === "meme_text") {
      formData.append("topText", topText);
      formData.append("bottomText", bottomText);
    } else if (commandType === "ai_meme") {
      formData.append("aiStyle", aiStyle);
    } else if (commandType === "quote_chat") {
      formData.append("quoteName", quoteName);
      formData.append("quoteText", quoteText);
    } else if (commandType === "brat_text") {
      formData.append("bratText", bratText);
    } else if (commandType === "breaking_news") {
      formData.append("newsHeadline", newsHeadline);
    }

    setIsLoading(true);

    try {
      const response = await fetch("/api/sticker", {
        method: "POST",
        body: formData,
      });

      if (!response.ok) {
        const errJson = (await response.json().catch(() => ({}))) as {
          error?: string;
        };
        throw new Error(
          errJson.error || `Gagal memproses stiker (${response.status})`
        );
      }

      const blob = await response.blob();
      const objectUrl = URL.createObjectURL(blob);

      const processMs = response.headers.get("X-Processing-Time-Ms") ?? "-";
      const sizeKb = response.headers.get("X-File-Size-Kb") ?? "-";
      const rawAiCaption = response.headers.get("X-Ai-Caption");
      const aiCaption = rawAiCaption ? decodeURIComponent(rawAiCaption) : null;

      setResult({
        url: objectUrl,
        sizeKb,
        processMs,
        commandType,
        aiCaption,
      });
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "Terjadi kesalahan tak terduga."
      );
    } finally {
      setIsLoading(false);
    }
  }

  return (
    <div className="grid gap-6 lg:grid-cols-12">
      {/* Kolom Kiri: Panel Kontrol & Form */}
      <div className="zine-card p-5 sm:p-6 lg:col-span-7">
        {/* Tab 5 Mode */}
        <div className="mb-6 border-b-2 border-[#161614] pb-4">
          <p className="mb-2.5 font-mono text-[10px] font-bold uppercase tracking-widest text-[#5C584F]">
            PILIH MODE CETAK STIKER
          </p>
          <div className="flex flex-wrap gap-2">
            {STUDIO_TABS.map((tab) => {
              const Icon = tab.icon;
              const isActive = activeTab === tab.id;
              return (
                <button
                  key={tab.id}
                  type="button"
                  onClick={() => {
                    setActiveTab(tab.id);
                    setError(null);
                  }}
                  className={`inline-flex items-center gap-1.5 border-2 border-[#161614] px-3 py-2 font-mono text-xs font-bold transition-all ${
                    isActive
                      ? "bg-[#161614] text-[#F5F0E6] shadow-[2px_2px_0_#B9F32B]"
                      : "bg-[#F5F0E6] text-[#161614] hover:bg-[#FFD646]"
                  }`}
                >
                  <Icon className="h-3.5 w-3.5" />
                  <span>{tab.label}</span>
                  {tab.badge && (
                    <span
                      className={`px-1 py-0.5 text-[9px] font-bold ${
                        isActive
                          ? "bg-[#B9F32B] text-[#161614]"
                          : "bg-[#161614] text-[#B9F32B]"
                      }`}
                    >
                      {tab.badge}
                    </span>
                  )}
                </button>
              );
            })}
          </div>
        </div>

        <form onSubmit={handleSubmit} className="space-y-5">
          {/* Upload Area */}
          {currentTabConfig.needsImage && (
            <div>
              <label className="mb-2 block font-mono text-xs font-bold uppercase text-[#161614]">
                Unggah Foto (JPG, PNG, WebP — Maks. 5 MB)
              </label>
              <div
                onClick={() => fileInputRef.current?.click()}
                onDragOver={(e) => {
                  e.preventDefault();
                  setIsDragging(true);
                }}
                onDragLeave={() => setIsDragging(false)}
                onDrop={onDrop}
                className={`flex cursor-pointer flex-col items-center justify-center border-2 border-dashed border-[#161614] p-5 text-center transition-colors ${
                  isDragging
                    ? "bg-[#B9F32B]/40"
                    : "bg-[#F5F0E6] hover:bg-[#EFE7D8]"
                }`}
              >
                <input
                  ref={fileInputRef}
                  type="file"
                  accept="image/*"
                  onChange={onFileInputChange}
                  className="hidden"
                />

                {previewUrl ? (
                  <div className="flex flex-col items-center gap-2">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img
                      src={previewUrl}
                      alt="Preview gambar"
                      className="max-h-40 border-2 border-[#161614] bg-white object-contain shadow-[3px_3px_0_#161614]"
                    />
                    <span className="font-mono text-xs font-medium text-[#3B3934]">
                      {selectedFile?.name} — klik atau seret foto lain untuk
                      ganti
                    </span>
                  </div>
                ) : (
                  <div className="flex flex-col items-center gap-2 py-3">
                    <div className="flex h-11 w-11 items-center justify-center border-2 border-[#161614] bg-[#FFD646] text-[#161614] shadow-[2px_2px_0_#161614]">
                      <Upload className="h-5 w-5" />
                    </div>
                    <p className="font-display text-sm font-bold text-[#161614]">
                      Klik untuk pilih foto atau seret langsung ke sini
                    </p>
                    <p className="font-mono text-[11px] text-[#5C584F]">
                      Otomatis dikonversi ke 512×512 WebP di bawah 100 KB
                    </p>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* Opsi Khusus Tab: Foto & Meme */}
          {activeTab === "photo" && (
            <div className="space-y-4">
              <div>
                <label className="mb-2 block font-mono text-xs font-bold uppercase text-[#161614]">
                  Gaya Potongan Foto
                </label>
                <div className="grid grid-cols-3 gap-2.5">
                  {[
                    { id: "standard", title: "Transparan", desc: "Utuh (Contain)" },
                    { id: "crop", title: "Smart Crop", desc: "Penuh 1:1" },
                    { id: "meme_text", title: "Meme Klasik", desc: "Teks Atas/Bawah" },
                  ].map((opt) => (
                    <button
                      key={opt.id}
                      type="button"
                      onClick={() => setPhotoSubMode(opt.id as PhotoSubMode)}
                      className={`border-2 border-[#161614] p-3 text-left transition-all ${
                        photoSubMode === opt.id
                          ? "bg-[#FFD646] shadow-[3px_3px_0_#161614]"
                          : "bg-[#FFFDF7] hover:bg-[#EFE7D8]"
                      }`}
                    >
                      <span className="block font-display text-xs font-bold text-[#161614] sm:text-sm">
                        {opt.title}
                      </span>
                      <span className="block font-mono text-[10px] text-[#45433D]">
                        {opt.desc}
                      </span>
                    </button>
                  ))}
                </div>
              </div>

              {photoSubMode === "meme_text" && (
                <div className="space-y-3">
                  <div className="grid gap-3 sm:grid-cols-2">
                    <div>
                      <label className="mb-1 block font-mono text-[11px] font-bold uppercase text-[#161614]">
                        Teks Atas
                      </label>
                      <input
                        type="text"
                        value={topText}
                        onChange={(e) => setTopText(e.target.value)}
                        placeholder="KETIKA DOSEN BILANG"
                        maxLength={80}
                        className="w-full border-2 border-[#161614] bg-[#FFFDF7] px-3 py-2.5 text-sm text-[#161614] focus:bg-[#FFFBEB] focus:outline-none"
                      />
                    </div>
                    <div>
                      <label className="mb-1 block font-mono text-[11px] font-bold uppercase text-[#161614]">
                        Teks Bawah
                      </label>
                      <input
                        type="text"
                        value={bottomText}
                        onChange={(e) => setBottomText(e.target.value)}
                        placeholder="REVISI DIKIT AJA KOK"
                        maxLength={80}
                        className="w-full border-2 border-[#161614] bg-[#FFFDF7] px-3 py-2.5 text-sm text-[#161614] focus:bg-[#FFFBEB] focus:outline-none"
                      />
                    </div>
                  </div>
                  <div className="flex flex-wrap items-center gap-1.5">
                    <span className="font-mono text-[10px] font-bold uppercase text-[#5C584F]">
                      Contoh cepat:
                    </span>
                    {MEME_PRESETS.map((preset) => (
                      <button
                        key={preset.top}
                        type="button"
                        onClick={() => {
                          setTopText(preset.top);
                          setBottomText(preset.bottom);
                        }}
                        className="cursor-pointer border border-[#161614] bg-[#EFE7D8] px-2 py-0.5 font-mono text-[10px] font-medium text-[#161614] hover:bg-[#FFD646]"
                      >
                        {preset.top} / {preset.bottom}
                      </button>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}

          {/* Opsi Khusus Tab: AI Meme / Roast */}
          {activeTab === "ai_meme" && (
            <div className="space-y-2">
              <label className="block font-mono text-xs font-bold uppercase text-[#161614]">
                Pilih Gaya Caption AI Vision (Gemini Flash)
              </label>
              <div className="grid grid-cols-2 gap-3">
                <button
                  type="button"
                  onClick={() => setAiStyle("aimeme")}
                  className={`border-2 border-[#161614] p-3.5 text-left transition-all ${
                    aiStyle === "aimeme"
                      ? "bg-[#FFD646] shadow-[3px_3px_0_#161614]"
                      : "bg-[#FFFDF7] hover:bg-[#EFE7D8]"
                  }`}
                >
                  <span className="block font-display text-sm font-bold text-[#161614]">
                    Auto-Meme (/aimeme)
                  </span>
                  <span className="block text-xs text-[#45433D]">
                    Komedi situasi relatable dari isi foto
                  </span>
                </button>
                <button
                  type="button"
                  onClick={() => setAiStyle("roast")}
                  className={`border-2 border-[#161614] p-3.5 text-left transition-all ${
                    aiStyle === "roast"
                      ? "bg-[#FFD646] shadow-[3px_3px_0_#161614]"
                      : "bg-[#FFFDF7] hover:bg-[#EFE7D8]"
                  }`}
                >
                  <span className="block font-display text-sm font-bold text-[#161614]">
                    AI Roast (/roast)
                  </span>
                  <span className="block text-xs text-[#45433D]">
                    Sindiran sarkas lucu &amp; santai anak kampus
                  </span>
                </button>
              </div>
            </div>
          )}

          {/* Opsi Khusus Tab: Quote Chat (/qc) */}
          {activeTab === "quote_chat" && (
            <div className="space-y-4">
              <div>
                <label className="mb-1.5 block font-mono text-xs font-bold uppercase text-[#161614]">
                  Nama Pengirim di Bubble Chat
                </label>
                <input
                  type="text"
                  value={quoteName}
                  onChange={(e) => setQuoteName(e.target.value)}
                  placeholder="Contoh: Ketua Kelompok"
                  maxLength={24}
                  className="w-full border-2 border-[#161614] bg-[#FFFDF7] px-3.5 py-2.5 text-sm text-[#161614] focus:bg-[#FFFBEB] focus:outline-none"
                />
              </div>
              <div>
                <label className="mb-1.5 block font-mono text-xs font-bold uppercase text-[#161614]">
                  Isi Pesan Quote
                </label>
                <textarea
                  rows={3}
                  value={quoteText}
                  onChange={(e) => setQuoteText(e.target.value)}
                  placeholder="Contoh: Besok bimbingan jam 8 pagi jangan kesiangan bro!"
                  maxLength={140}
                  className="w-full border-2 border-[#161614] bg-[#FFFDF7] px-3.5 py-2.5 text-sm text-[#161614] focus:bg-[#FFFBEB] focus:outline-none"
                />
                <p className="mt-1 font-mono text-[11px] text-[#5C584F]">
                  Dirender jadi bubble WhatsApp Dark Mode transparan lengkap
                  dengan jam WIB &amp; centang biru.
                </p>
                <div className="mt-2.5 flex flex-wrap items-center gap-1.5">
                  <span className="font-mono text-[10px] font-bold uppercase text-[#5C584F]">
                    Contoh cepat:
                  </span>
                  {QUOTE_PRESETS.map((preset) => (
                    <button
                      key={preset.text}
                      type="button"
                      onClick={() => {
                        setQuoteName(preset.name);
                        setQuoteText(preset.text);
                      }}
                      className="cursor-pointer border border-[#161614] bg-[#EFE7D8] px-2 py-0.5 font-mono text-[10px] font-medium text-[#161614] hover:bg-[#FFD646]"
                    >
                      &ldquo;{preset.text.slice(0, 26)}...&rdquo;
                    </button>
                  ))}
                </div>
              </div>
            </div>
          )}

          {/* Opsi Khusus Tab: Brat Text (/brat) */}
          {activeTab === "brat_text" && (
            <div>
              <label className="mb-1.5 block font-mono text-xs font-bold uppercase text-[#161614]">
                Teks Stiker Brat
              </label>
              <textarea
                rows={3}
                value={bratText}
                onChange={(e) => setBratText(e.target.value)}
                placeholder="Contoh: lagi pusing revisi bab 4"
                maxLength={100}
                className="w-full border-2 border-[#161614] bg-[#FFFDF7] px-3.5 py-2.5 text-sm text-[#161614] focus:bg-[#FFFBEB] focus:outline-none"
              />
              <p className="mt-1 font-mono text-[11px] text-[#5C584F]">
                Latar hijau khas Brat (#8ACE00) dengan efek tipografi low-fi
                blur.
              </p>
              <div className="mt-2.5 flex flex-wrap items-center gap-1.5">
                <span className="font-mono text-[10px] font-bold uppercase text-[#5C584F]">
                  Contoh cepat:
                </span>
                {BRAT_PRESETS.map((preset) => (
                  <button
                    key={preset}
                    type="button"
                    onClick={() => setBratText(preset)}
                    className="cursor-pointer border border-[#161614] bg-[#EFE7D8] px-2 py-0.5 font-mono text-[10px] font-medium text-[#161614] hover:bg-[#B9F32B]"
                  >
                    {preset}
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* Opsi Khusus Tab: Breaking News (/news) */}
          {activeTab === "breaking_news" && (
            <div>
              <label className="mb-1.5 block font-mono text-xs font-bold uppercase text-[#161614]">
                Headline Berita TV
              </label>
              <input
                type="text"
                value={newsHeadline}
                onChange={(e) => setNewsHeadline(e.target.value)}
                placeholder="Contoh: MAHASISWA INI BELUM TIDUR 2 HARI DEMI CAPSTONE"
                maxLength={85}
                className="w-full border-2 border-[#161614] bg-[#FFFDF7] px-3.5 py-2.5 text-sm text-[#161614] focus:bg-[#FFFBEB] focus:outline-none"
              />
              <p className="mt-1 font-mono text-[11px] text-[#5C584F]">
                Otomatis ditambahkan badge LIVE di kanan atas dan ticker
                BREAKING NEWS dengan jam WIB.
              </p>
              <div className="mt-2.5 flex flex-wrap items-center gap-1.5">
                <span className="font-mono text-[10px] font-bold uppercase text-[#5C584F]">
                  Contoh cepat:
                </span>
                {NEWS_PRESETS.map((preset) => (
                  <button
                    key={preset}
                    type="button"
                    onClick={() => setNewsHeadline(preset)}
                    className="cursor-pointer border border-[#161614] bg-[#EFE7D8] px-2 py-0.5 font-mono text-[10px] font-medium text-[#161614] hover:bg-[#FFD646]"
                  >
                    {preset.slice(0, 28)}...
                  </button>
                ))}
              </div>
            </div>
          )}

          {error && (
            <div className="flex items-start gap-2.5 border-2 border-[#161614] bg-[#EB3B2E] p-3.5 text-sm font-medium text-white shadow-[3px_3px_0_#161614]">
              <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />
              <span>{error}</span>
            </div>
          )}

          <button
            type="submit"
            disabled={isLoading}
            className="zine-btn flex w-full cursor-pointer items-center justify-center gap-2 bg-[#B9F32B] px-5 py-3.5 font-display text-sm font-bold text-[#161614] disabled:cursor-not-allowed disabled:opacity-60 sm:text-base"
          >
            {isLoading ? (
              <>
                <Loader2 className="h-4 w-4 animate-spin" />
                <span>
                  {activeTab === "ai_meme"
                    ? "AI sedang membaca fotomu..."
                    : "Mencetak stiker WebP..."}
                </span>
              </>
            ) : (
              <>
                {result ? (
                  <RefreshCw className="h-4 w-4" />
                ) : (
                  <Sparkles className="h-4 w-4" />
                )}
                <span>Cetak Stiker WebP Sekarang</span>
              </>
            )}
          </button>
        </form>
      </div>

      {/* Kolom Kanan: Cutting Mat Preview & Download */}
      <div className="zine-card flex flex-col justify-between p-5 sm:p-6 lg:col-span-5">
        <div>
          <div className="mb-4 flex items-center justify-between border-b-2 border-[#161614] pb-3">
            <h2 className="font-display text-base font-bold text-[#161614]">
              MEJA PREVIEW (.WEBP)
            </h2>
            <span className="border-2 border-[#161614] bg-[#EFE7D8] px-2 py-0.5 font-mono text-[11px] font-bold text-[#161614]">
              512 × 512 PX
            </span>
          </div>

          {/* Kanvas Preview dengan pola checkerboard + tanda registrasi cetak */}
          <div
            className="relative flex aspect-square w-full items-center justify-center overflow-hidden border-2 border-[#161614] p-4"
            style={{
              backgroundImage:
                "linear-gradient(45deg, #e7e0d2 25%, transparent 25%), linear-gradient(-45deg, #e7e0d2 25%, transparent 25%), linear-gradient(45deg, transparent 75%, #e7e0d2 75%), linear-gradient(-45deg, transparent 75%, #e7e0d2 75%)",
              backgroundSize: "20px 20px",
              backgroundPosition: "0 0, 0 10px, 10px -10px, -10px 0px",
              backgroundColor: "#fffdf7",
            }}
          >
            <span className="pointer-events-none absolute top-1.5 left-2 font-mono text-xs font-bold text-[#161614]/40">
              +
            </span>
            <span className="pointer-events-none absolute top-1.5 right-2 font-mono text-xs font-bold text-[#161614]/40">
              +
            </span>
            <span className="pointer-events-none absolute bottom-1.5 left-2 font-mono text-xs font-bold text-[#161614]/40">
              +
            </span>
            <span className="pointer-events-none absolute right-2 bottom-1.5 font-mono text-xs font-bold text-[#161614]/40">
              +
            </span>

            {isLoading ? (
              <div className="flex flex-col items-center gap-3 border-2 border-[#161614] bg-[#FFFDF7] px-5 py-4 shadow-[3px_3px_0_#161614]">
                <Loader2 className="h-7 w-7 animate-spin text-[#161614]" />
                <p className="font-mono text-xs font-bold uppercase">
                  Merender stiker...
                </p>
              </div>
            ) : result ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={result.url}
                alt="Hasil stiker WebP"
                className="h-full w-full object-contain drop-shadow-sm"
              />
            ) : (
              <div className="border-2 border-[#161614] bg-[#FFFDF7]/95 px-5 py-4 text-center shadow-[3px_3px_0_#161614]">
                <ImageIcon className="mx-auto mb-2 h-8 w-8 text-[#161614]" />
                <p className="font-display text-sm font-bold text-[#161614]">
                  Hasil stiker muncul di sini
                </p>
                <p className="mt-1 font-mono text-[11px] text-[#5C584F]">
                  Kotak-kotak menandakan area transparan
                </p>
              </div>
            )}
          </div>

          {result?.aiCaption && (
            <div className="mt-3 border-2 border-[#161614] bg-[#FFD646] p-3 text-xs text-[#161614]">
              <span className="font-mono font-bold uppercase">
                Caption AI:{" "}
              </span>
              <span className="font-medium">{result.aiCaption}</span>
            </div>
          )}
        </div>

        {/* Metadata & Tombol Download */}
        <div className="mt-5 space-y-3">
          {result && (
            <div className="grid grid-cols-2 gap-2.5">
              <div className="flex items-center gap-2 border-2 border-[#161614] bg-[#F5F0E6] px-3 py-2 text-xs text-[#161614]">
                <Clock className="h-4 w-4" />
                <div>
                  <span className="block font-mono text-[10px] uppercase text-[#5C584F]">
                    Waktu Proses
                  </span>
                  <span className="font-mono font-bold">
                    {result.processMs} ms
                  </span>
                </div>
              </div>
              <div className="flex items-center gap-2 border-2 border-[#161614] bg-[#F5F0E6] px-3 py-2 text-xs text-[#161614]">
                <HardDrive className="h-4 w-4" />
                <div>
                  <span className="block font-mono text-[10px] uppercase text-[#5C584F]">
                    Ukuran File
                  </span>
                  <span className="font-mono font-bold">
                    {result.sizeKb} KB
                  </span>
                </div>
              </div>
            </div>
          )}

          <a
            href={result?.url ?? "#"}
            download={result ? `sticker-${result.commandType}.webp` : undefined}
            aria-disabled={!result}
            onClick={(e) => {
              if (!result) e.preventDefault();
            }}
            className={`flex w-full items-center justify-center gap-2 border-2 border-[#161614] px-4 py-3 font-display text-sm font-bold transition-all ${
              result
                ? "zine-btn bg-[#161614] text-[#F5F0E6] hover:bg-[#2B2925]"
                : "pointer-events-none bg-[#EFE7D8] text-[#8E897E]"
            }`}
          >
            <Download className="h-4 w-4" />
            <span>Download Stiker (.webp)</span>
          </a>
        </div>
      </div>
    </div>
  );
}
