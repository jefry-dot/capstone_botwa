"use client";

import { useEffect, useRef, useState, type ChangeEvent, type DragEvent, type FormEvent } from "react";
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

type StudioTab = "photo" | "ai_meme" | "quote_chat" | "brat_text" | "breaking_news";
type PhotoSubMode = "standard" | "crop" | "meme_text";
type AiStyle = "aimeme" | "roast";

interface GeneratedSticker {
  url: string;
  sizeKb: string;
  processMs: string;
  commandType: string;
  aiCaption: string | null;
}

const STUDIO_TABS: Array<{
  id: StudioTab;
  label: string;
  badge?: string;
  icon: typeof ImageIcon;
  needsImage: boolean;
}> = [
  { id: "photo", label: "Foto & Meme", icon: ImageIcon, needsImage: true },
  { id: "ai_meme", label: "AI Meme / Roast", badge: "AI", icon: Sparkles, needsImage: true },
  { id: "quote_chat", label: "Quote Chat", icon: MessageSquareQuote, needsImage: false },
  { id: "brat_text", label: "Brat Text", icon: Type, needsImage: false },
  { id: "breaking_news", label: "Breaking News", icon: Tv, needsImage: true },
];

export default function StickerUploader() {
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  const [activeTab, setActiveTab] = useState<StudioTab>("photo");
  const [photoSubMode, setPhotoSubMode] = useState<PhotoSubMode>("standard");

  // State file gambar
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [isDragging, setIsDragging] = useState(false);

  // State input teks per mode
  const [topText, setTopText] = useState("");
  const [bottomText, setBottomText] = useState("");
  const [aiStyle, setAiStyle] = useState<AiStyle>("aimeme");
  const [quoteName, setQuoteName] = useState("Mahasiswa Capstone");
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
        const errJson = (await response.json().catch(() => ({}))) as { error?: string };
        throw new Error(errJson.error || `Gagal memproses stiker (${response.status})`);
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
      setError(err instanceof Error ? err.message : "Terjadi kesalahan tak terduga.");
    } finally {
      setIsLoading(false);
    }
  }

  return (
    <div className="grid gap-6 lg:grid-cols-12">
      {/* Kolom Kiri: Panel Kontrol & Form */}
      <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm sm:p-6 lg:col-span-7">
        {/* Tab 5 Mode */}
        <div className="mb-6 flex flex-wrap gap-2">
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
                className={`inline-flex items-center gap-1.5 rounded-xl px-3.5 py-2 text-xs font-semibold transition-all sm:text-sm ${
                  isActive
                    ? "bg-slate-900 text-white shadow-sm"
                    : "bg-slate-100 text-slate-700 hover:bg-slate-200"
                }`}
              >
                <Icon className="h-4 w-4" />
                <span>{tab.label}</span>
                {tab.badge && (
                  <span
                    className={`rounded-md px-1.5 py-0.5 text-[10px] font-bold ${
                      isActive
                        ? "bg-emerald-500 text-white"
                        : "bg-emerald-100 text-emerald-700"
                    }`}
                  >
                    {tab.badge}
                  </span>
                )}
              </button>
            );
          })}
        </div>

        <form onSubmit={handleSubmit} className="space-y-5">
          {/* Upload Area (hanya muncul untuk mode yang butuh gambar) */}
          {currentTabConfig.needsImage && (
            <div>
              <label className="mb-2 block text-sm font-semibold text-slate-800">
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
                className={`flex cursor-pointer flex-col items-center justify-center rounded-xl border-2 border-dashed p-5 text-center transition-colors ${
                  isDragging
                    ? "border-emerald-500 bg-emerald-50"
                    : "border-slate-300 bg-slate-50 hover:border-slate-400 hover:bg-slate-100/70"
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
                      className="max-h-40 rounded-lg border border-slate-200 object-contain shadow-xs"
                    />
                    <span className="text-xs font-medium text-slate-600">
                      {selectedFile?.name} — klik atau seret foto lain untuk ganti
                    </span>
                  </div>
                ) : (
                  <div className="flex flex-col items-center gap-2 py-3">
                    <div className="flex h-11 w-11 items-center justify-center rounded-full bg-white text-slate-600 shadow-xs">
                      <Upload className="h-5 w-5" />
                    </div>
                    <p className="text-sm font-medium text-slate-700">
                      Klik untuk pilih foto atau tarik langsung ke sini
                    </p>
                    <p className="text-xs text-slate-500">
                      Otomatis dikonversi ke 512x512 WebP di bawah 100 KB
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
                <label className="mb-2 block text-sm font-semibold text-slate-800">
                  Gaya Konversi Foto
                </label>
                <div className="grid grid-cols-3 gap-2">
                  {[
                    { id: "standard", title: "Transparan", desc: "Utuh (Contain)" },
                    { id: "crop", title: "Smart Crop", desc: "Kotak Penuh 1:1" },
                    { id: "meme_text", title: "Meme Klasik", desc: "Teks Atas/Bawah" },
                  ].map((opt) => (
                    <button
                      key={opt.id}
                      type="button"
                      onClick={() => setPhotoSubMode(opt.id as PhotoSubMode)}
                      className={`rounded-xl border p-3 text-left transition-all ${
                        photoSubMode === opt.id
                          ? "border-emerald-600 bg-emerald-50/70 ring-1 ring-emerald-600"
                          : "border-slate-200 hover:border-slate-300"
                      }`}
                    >
                      <span className="block text-xs font-bold text-slate-900 sm:text-sm">
                        {opt.title}
                      </span>
                      <span className="block text-[11px] text-slate-500">{opt.desc}</span>
                    </button>
                  ))}
                </div>
              </div>

              {photoSubMode === "meme_text" && (
                <div className="grid gap-3 sm:grid-cols-2">
                  <div>
                    <label className="mb-1 block text-xs font-semibold text-slate-700">
                      Teks Atas
                    </label>
                    <input
                      type="text"
                      value={topText}
                      onChange={(e) => setTopText(e.target.value)}
                      placeholder="Contoh: KETIKA DOSEN BILANG"
                      maxLength={80}
                      className="w-full rounded-xl border border-slate-300 px-3.5 py-2.5 text-sm text-slate-900 focus:border-slate-900 focus:outline-none"
                    />
                  </div>
                  <div>
                    <label className="mb-1 block text-xs font-semibold text-slate-700">
                      Teks Bawah
                    </label>
                    <input
                      type="text"
                      value={bottomText}
                      onChange={(e) => setBottomText(e.target.value)}
                      placeholder="Contoh: REVISI DIKIT AJA KOK"
                      maxLength={80}
                      className="w-full rounded-xl border border-slate-300 px-3.5 py-2.5 text-sm text-slate-900 focus:border-slate-900 focus:outline-none"
                    />
                  </div>
                </div>
              )}
            </div>
          )}

          {/* Opsi Khusus Tab: AI Meme / Roast */}
          {activeTab === "ai_meme" && (
            <div className="space-y-2">
              <label className="block text-sm font-semibold text-slate-800">
                Pilih Gaya Caption AI Vision (Gemini Flash)
              </label>
              <div className="grid grid-cols-2 gap-3">
                <button
                  type="button"
                  onClick={() => setAiStyle("aimeme")}
                  className={`rounded-xl border p-3.5 text-left transition-all ${
                    aiStyle === "aimeme"
                      ? "border-emerald-600 bg-emerald-50/70 ring-1 ring-emerald-600"
                      : "border-slate-200 hover:border-slate-300"
                  }`}
                >
                  <span className="block text-sm font-bold text-slate-900">
                    Auto-Meme (/aimeme)
                  </span>
                  <span className="block text-xs text-slate-600">
                    Komedi situasi relatable dari isi foto
                  </span>
                </button>
                <button
                  type="button"
                  onClick={() => setAiStyle("roast")}
                  className={`rounded-xl border p-3.5 text-left transition-all ${
                    aiStyle === "roast"
                      ? "border-emerald-600 bg-emerald-50/70 ring-1 ring-emerald-600"
                      : "border-slate-200 hover:border-slate-300"
                  }`}
                >
                  <span className="block text-sm font-bold text-slate-900">
                    AI Roast (/roast)
                  </span>
                  <span className="block text-xs text-slate-600">
                    Sindiran sarkas lucu & santai anak kampus
                  </span>
                </button>
              </div>
            </div>
          )}

          {/* Opsi Khusus Tab: Quote Chat (/qc) */}
          {activeTab === "quote_chat" && (
            <div className="space-y-4">
              <div>
                <label className="mb-1.5 block text-sm font-semibold text-slate-800">
                  Nama Pengirim di Bubble Chat
                </label>
                <input
                  type="text"
                  value={quoteName}
                  onChange={(e) => setQuoteName(e.target.value)}
                  placeholder="Contoh: Ketua Kelompok"
                  maxLength={24}
                  className="w-full rounded-xl border border-slate-300 px-3.5 py-2.5 text-sm text-slate-900 focus:border-slate-900 focus:outline-none"
                />
              </div>
              <div>
                <label className="mb-1.5 block text-sm font-semibold text-slate-800">
                  Isi Pesan Quote
                </label>
                <textarea
                  rows={3}
                  value={quoteText}
                  onChange={(e) => setQuoteText(e.target.value)}
                  placeholder="Contoh: Besok bimbingan jam 8 pagi jangan kesiangan bro!"
                  maxLength={140}
                  className="w-full rounded-xl border border-slate-300 px-3.5 py-2.5 text-sm text-slate-900 focus:border-slate-900 focus:outline-none"
                />
                <p className="mt-1 text-xs text-slate-500">
                  Dirender jadi bubble WhatsApp Dark Mode transparan lengkap dengan jam WIB & centang biru.
                </p>
              </div>
            </div>
          )}

          {/* Opsi Khusus Tab: Brat Text (/brat) */}
          {activeTab === "brat_text" && (
            <div>
              <label className="mb-1.5 block text-sm font-semibold text-slate-800">
                Teks Stiker Brat
              </label>
              <textarea
                rows={3}
                value={bratText}
                onChange={(e) => setBratText(e.target.value)}
                placeholder="Contoh: lagi pusing revisi bab 4"
                maxLength={100}
                className="w-full rounded-xl border border-slate-300 px-3.5 py-2.5 text-sm text-slate-900 focus:border-slate-900 focus:outline-none"
              />
              <p className="mt-1 text-xs text-slate-500">
                Otomatis memakai latar hijau khas Brat (#8ACE00) dengan efek tipografi low-fi blur.
              </p>
            </div>
          )}

          {/* Opsi Khusus Tab: Breaking News (/news) */}
          {activeTab === "breaking_news" && (
            <div>
              <label className="mb-1.5 block text-sm font-semibold text-slate-800">
                Headline Berita TV
              </label>
              <input
                type="text"
                value={newsHeadline}
                onChange={(e) => setNewsHeadline(e.target.value)}
                placeholder="Contoh: MAHASISWA INI BELUM TIDUR 2 HARI DEMI CAPSTONE"
                maxLength={85}
                className="w-full rounded-xl border border-slate-300 px-3.5 py-2.5 text-sm text-slate-900 focus:border-slate-900 focus:outline-none"
              />
              <p className="mt-1 text-xs text-slate-500">
                Otomatis ditambahkan badge LIVE di kanan atas dan ticker BREAKING NEWS dengan jam WIB.
              </p>
            </div>
          )}

          {error && (
            <div className="flex items-start gap-2.5 rounded-xl border border-red-200 bg-red-50 p-3.5 text-sm text-red-700">
              <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />
              <span>{error}</span>
            </div>
          )}

          <button
            type="submit"
            disabled={isLoading}
            className="flex w-full items-center justify-center gap-2 rounded-xl bg-emerald-600 px-5 py-3 text-sm font-bold text-white shadow-sm transition-colors hover:bg-emerald-700 disabled:cursor-not-allowed disabled:opacity-60"
          >
            {isLoading ? (
              <>
                <Loader2 className="h-4 w-4 animate-spin" />
                <span>
                  {activeTab === "ai_meme"
                    ? "AI sedang menganalisis foto..."
                    : "Memproses stiker WebP..."}
                </span>
              </>
            ) : (
              <>
                {result ? <RefreshCw className="h-4 w-4" /> : <Sparkles className="h-4 w-4" />}
                <span>Buat Stiker WebP Sekarang</span>
              </>
            )}
          </button>
        </form>
      </div>

      {/* Kolom Kanan: Live Preview & Download */}
      <div className="flex flex-col justify-between rounded-2xl border border-slate-200 bg-white p-5 shadow-sm sm:p-6 lg:col-span-5">
        <div>
          <div className="mb-4 flex items-center justify-between">
            <h2 className="text-base font-bold text-slate-900">Hasil Stiker (.webp)</h2>
            <span className="rounded-full bg-slate-100 px-2.5 py-1 text-xs font-medium text-slate-600">
              512 × 512 px
            </span>
          </div>

          {/* Kanvas Preview dengan pola checkerboard transparan */}
          <div
            className="flex aspect-square w-full items-center justify-center overflow-hidden rounded-xl border border-slate-200 p-4"
            style={{
              backgroundImage:
                "linear-gradient(45deg, #f1f5f9 25%, transparent 25%), linear-gradient(-45deg, #f1f5f9 25%, transparent 25%), linear-gradient(45deg, transparent 75%, #f1f5f9 75%), linear-gradient(-45deg, transparent 75%, #f1f5f9 75%)",
              backgroundSize: "20px 20px",
              backgroundPosition: "0 0, 0 10px, 10px -10px, -10px 0px",
              backgroundColor: "#ffffff",
            }}
          >
            {isLoading ? (
              <div className="flex flex-col items-center gap-3 text-slate-500">
                <Loader2 className="h-9 w-9 animate-spin text-emerald-600" />
                <p className="text-xs font-medium">Merender stiker...</p>
              </div>
            ) : result ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={result.url}
                alt="Hasil stiker WebP"
                className="h-full w-full object-contain drop-shadow-sm"
              />
            ) : (
              <div className="text-center text-slate-400">
                <ImageIcon className="mx-auto mb-2 h-10 w-10 opacity-60" />
                <p className="text-sm font-medium text-slate-500">
                  Preview stiker muncul di sini
                </p>
                <p className="mt-1 text-xs">
                  Pola kotak menunjukkan area transparan
                </p>
              </div>
            )}
          </div>

          {/* Caption hasil AI Vision (jika mode ai_meme) */}
          {result?.aiCaption && (
            <div className="mt-3 rounded-xl border border-emerald-200 bg-emerald-50 p-3 text-xs text-emerald-900">
              <span className="font-bold">Caption AI Vision: </span>
              <span>{result.aiCaption}</span>
            </div>
          )}
        </div>

        {/* Metadata & Tombol Download */}
        <div className="mt-5 space-y-3">
          {result && (
            <div className="grid grid-cols-2 gap-2.5">
              <div className="flex items-center gap-2 rounded-xl bg-slate-50 px-3 py-2 text-xs text-slate-700">
                <Clock className="h-4 w-4 text-emerald-600" />
                <div>
                  <span className="block text-[10px] text-slate-500">Waktu Proses</span>
                  <span className="font-bold">{result.processMs} ms</span>
                </div>
              </div>
              <div className="flex items-center gap-2 rounded-xl bg-slate-50 px-3 py-2 text-xs text-slate-700">
                <HardDrive className="h-4 w-4 text-emerald-600" />
                <div>
                  <span className="block text-[10px] text-slate-500">Ukuran File</span>
                  <span className="font-bold">{result.sizeKb} KB</span>
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
            className={`flex w-full items-center justify-center gap-2 rounded-xl px-4 py-3 text-sm font-bold transition-colors ${
              result
                ? "bg-slate-900 text-white hover:bg-slate-800"
                : "pointer-events-none bg-slate-100 text-slate-400"
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