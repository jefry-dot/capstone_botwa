# Project Blueprint: WhatsApp Sticker Bot & Web Dashboard

> **Dokumen Patokan Eksekusi (Agent-Ready Spec)**  
> **Target:** Project Kampus (100% Free Tier - Rp 0)  
> **Stack:** Next.js App Router (TypeScript) + Tailwind CSS + Sharp + Meta WhatsApp Cloud API + Supabase + Vercel

---

## 1. Ringkasan & Tujuan Project

Aplikasi fullstack dalam satu repositori Next.js yang menggabungkan dua kanal pembuatan stiker WhatsApp menggunakan **Shared Image Processing Engine (`sharp`)**:

1. **WhatsApp Sticker Bot (via Meta Cloud API):** User mengirim foto ke nomor WhatsApp bot (dengan atau tanpa caption teks meme), lalu bot otomatis mengonversi gambar menjadi stiker `.webp` (`512x512` px, kurang dari `100KB`) dan mengirimnya kembali.
2. **Web Sticker Maker & Live Monitoring Dashboard (via Vercel):**
   - **Halaman Utama (`/`):** Alat pembuat stiker langsung dari browser (upload foto, tambah teks atas/bawah opsional, preview, dan download `.webp`).
   - **Dashboard (`/dashboard`):** Menampilkan statistik penggunaan real-time (total stiker, rata-rata waktu proses dalam ms, grafik harian, dan tabel aktivitas terbaru) dari Supabase tanpa membocorkan nomor HP user.

---

## 2. Tech Stack & Batasan Teknis (Hard Constraints)

- **Framework:** Next.js 15+ (App Router, `src/` directory, TypeScript)
- **Styling & UI:** Tailwind CSS, `lucide-react` (ikon), `recharts` (grafik dashboard)
- **Image Processing:** `sharp` (Wajib berjalan di Node.js Runtime, bukan Edge Runtime)
- **Database:** Supabase (PostgreSQL) via `@supabase/supabase-js`
- **WhatsApp Gateway:** Meta WhatsApp Cloud API (Graph API `v21.0`+)
- **Hosting:** Vercel (Free Hobby Tier)

### Aturan Wajib untuk Implementasi
1. **Hanya Stiker Statis:** Jangan gunakan `ffmpeg` atau memproses video/GIF agar aman dari limit timeout serverless Vercel.
2. **Spesifikasi Stiker WA:** Output wajib format `.webp`, dimensi tepat `512x512` px (`fit: 'contain'` dengan background transparan agar tidak gepeng), dan ukuran file akhir wajib **di bawah 100 KB** (lakukan penurunan kualitas bertahap jika masih melebihi 100 KB).
3. **Webhook Non-Blocking (`after()`):** Route `POST /api/webhook` harus segera mengembalikan HTTP `200 OK` ke Meta untuk mencegah *webhook retry loop*. Bungkus proses download gambar, olah `sharp`, upload media, pengiriman stiker, dan logging Supabase di dalam fungsi `after()` dari `next/server`.
4. **Verifikasi Keamanan Webhook:** Setiap request `POST /api/webhook` wajib diverifikasi header `x-hub-signature-256` menggunakan HMAC-SHA256 dan `WHATSAPP_APP_SECRET`.
5. **Privasi Data:** Frontend tidak boleh mengakses tabel mentah `wa_users` atau `sticker_logs` secara langsung. Gunakan `SUPABASE_SERVICE_ROLE_KEY` hanya di server-side API route, dan baca data dashboard melalui SQL View publik yang sudah disanitasi.

---

## 3. Arsitektur Sistem & Alur Data

```text
                       +---------------------------+
                       |   User WhatsApp (HP)      |
                       +-------------+-------------+
                                     | Kirim Foto (+ Caption) / Terima Stiker
                                     v
                       +---------------------------+
                       |  Meta WhatsApp Cloud API  |
                       +-------------+-------------+
                                     | Webhook (POST) & Media API
                                     v
+-------------------------------------------------------------------------+
|                     VERCEL (Next.js App Router)                         |
|                                                                         |
|  [Web Frontend]                  [Backend API Routes]                   |
|  - / (Web Sticker Maker)  ---->  - POST /api/sticker (Konversi Web)     |
|  - /dashboard (Statistik) ---->  - GET  /api/stats   (Data Grafik)      |
|                                  - GET/POST /api/webhook (Bot WA)       |
|                                               |                         |
|                                               v                         |
|                                  [Core Library: src/lib/]               |
|                                  - sticker-processor.ts (Sharp -> WebP) |
|                                  - whatsapp.ts (Meta Graph API client)  |
+-----------------------------------------------+-------------------------+
                                                | Insert Log / Query Stats
                                                v
                       +---------------------------+
                       |  SUPABASE (PostgreSQL)    |
                       |  - Tabel: wa_users        |
                       |  - Tabel: sticker_logs    |
                       |  - Views: dashboard_*     |
                       +---------------------------+
```

### Alur Bot WhatsApp (`POST /api/webhook`)
1. Terima payload JSON dan raw body dari Meta; validasi `x-hub-signature-256`.
2. Cek apakah payload berisi pesan masuk bertipe `image`. Jika pesan teks biasa (misal `/help` atau halo), balas pesan panduan singkat cara pakai bot.
3. Segera return `NextResponse.json({ status: 'ok' }, { status: 200 })`, sementara pemrosesan dijalankan di dalam `after(async () => { ... })`:
   - Catat waktu mulai (`Date.now()`).
   - Upsert data pengirim (`wa_id` dan `profile_name`) ke tabel `wa_users`.
   - Ambil URL media dari Meta Graph API (`GET /{media_id}`) lalu download binary gambarnya dengan Bearer token.
   - Parse caption:
     - Kosong / `/stiker` -> `command_type = 'standard'`
     - `/stiker Teks Atas | Teks Bawah` -> `command_type = 'meme_text'`
   - Proses buffer gambar via `processImageToSticker(buffer, options)` di `src/lib/sticker-processor.ts`.
   - Upload buffer `.webp` ke Meta (`POST /{phone_number_id}/media`) untuk mendapatkan `sticker_media_id`.
   - Kirim balik pesan bertipe `sticker` ke `wa_id` pengirim.
   - Simpan metrik hasil (`status`, `processing_time_ms`, `file_size_kb`, `error_message`) ke tabel `sticker_logs`.

---

## 4. Struktur Folder Project

```text
wa-sticker-bot/
├── PROJECT_BLUEPRINT.md              # Dokumen patokan ini
├── next.config.ts                    # serverExternalPackages: ['sharp']
├── .env.local                        # Environment variables lokal
├── package.json
└── src/
    ├── app/
    │   ├── layout.tsx                # Root layout, font, navbar (Maker & Dashboard)
    │   ├── globals.css               # Tailwind CSS
    │   ├── page.tsx                  # Halaman Web Sticker Maker
    │   ├── dashboard/
    │   │   └── page.tsx              # Halaman Dashboard Monitoring
    │   └── api/
    │       ├── webhook/
    │       │   └── route.ts          # GET (verify) & POST (handle WA events)
    │       ├── sticker/
    │       │   └── route.ts          # POST (upload foto dari web -> return WebP)
    │       └── stats/
    │           └── route.ts          # GET (query aggregated views dari Supabase)
    ├── components/
    │   ├── Navbar.tsx                # Navigasi sederhana antar halaman
    │   ├── StickerUploader.tsx       # Drag & drop, input teks meme, preview, download
    │   ├── StatsCards.tsx            # KPI Cards (Total Stiker, Avg Latency, Success Rate, User)
    │   ├── ActivityChart.tsx         # Grafik tren harian WA vs Web (Recharts)
    │   └── RecentLogsTable.tsx       # Tabel 20 aktivitas terbaru
    ├── lib/
    │   ├── sticker-processor.ts      # Engine Sharp (resize 512x512, SVG meme text, WebP <100KB)
    │   ├── whatsapp.ts               # Client Meta Graph API (download, upload, send text/sticker)
    │   ├── signature.ts              # Validasi HMAC-SHA256 Meta Webhook
    │   └── supabase.ts               # Client supabaseAdmin (server)
    └── types/
        ├── whatsapp.ts               # TypeScript interfaces payload Meta Webhook
        └── database.ts               # TypeScript interfaces tabel & view Supabase
```

---

## 5. Skema Database Supabase (PostgreSQL)

Jalankan seluruh script SQL ini di **Supabase SQL Editor**:

```sql
-- 1. Tabel User WhatsApp
CREATE TABLE public.wa_users (
  wa_id TEXT PRIMARY KEY,
  profile_name TEXT,
  total_stickers INTEGER NOT NULL DEFAULT 0,
  first_seen_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  last_active_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 2. Tabel Log Pembuatan Stiker
CREATE TABLE public.sticker_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  wa_id TEXT REFERENCES public.wa_users(wa_id) ON DELETE SET NULL,
  source TEXT NOT NULL CHECK (source IN ('whatsapp', 'web')),
  command_type TEXT NOT NULL DEFAULT 'standard' CHECK (command_type IN ('standard', 'meme_text', 'crop')),
  caption_text TEXT,
  status TEXT NOT NULL CHECK (status IN ('success', 'failed')),
  error_message TEXT,
  processing_time_ms INTEGER,
  file_size_kb NUMERIC(6, 2),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Index untuk performa query dashboard
CREATE INDEX idx_sticker_logs_created_at ON public.sticker_logs (created_at DESC);
CREATE INDEX idx_sticker_logs_source ON public.sticker_logs (source);

-- 3. Trigger Otomatis Update Counter User WA
CREATE OR REPLACE FUNCTION public.increment_user_sticker_count()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.source = 'whatsapp' AND NEW.status = 'success' AND NEW.wa_id IS NOT NULL THEN
    UPDATE public.wa_users
    SET
      total_stickers = total_stickers + 1,
      last_active_at = NOW()
    WHERE wa_id = NEW.wa_id;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE TRIGGER trg_increment_sticker_count
AFTER INSERT ON public.sticker_logs
FOR EACH ROW
EXECUTE FUNCTION public.increment_user_sticker_count();

-- 4. Aktifkan Row Level Security (RLS)
ALTER TABLE public.wa_users ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.sticker_logs ENABLE ROW LEVEL SECURITY;

-- 5. View Agregasi Aman untuk Dashboard Publik (Tanpa Nomor HP)
CREATE OR REPLACE VIEW public.dashboard_daily_stats AS
SELECT
  DATE_TRUNC('day', created_at AT TIME ZONE 'Asia/Jakarta')::DATE AS log_date,
  source,
  COUNT(*) FILTER (WHERE status = 'success') AS success_count,
  COUNT(*) FILTER (WHERE status = 'failed') AS failed_count,
  ROUND(AVG(processing_time_ms) FILTER (WHERE status = 'success')) AS avg_process_ms,
  ROUND(AVG(file_size_kb) FILTER (WHERE status = 'success'), 2) AS avg_size_kb
FROM public.sticker_logs
GROUP BY 1, 2
ORDER BY 1 DESC;

CREATE OR REPLACE VIEW public.dashboard_recent_activity AS
SELECT
  l.id,
  l.source,
  COALESCE(u.profile_name, 'Web User') AS display_name,
  l.command_type,
  l.status,
  l.processing_time_ms,
  l.file_size_kb,
  l.created_at
FROM public.sticker_logs l
LEFT JOIN public.wa_users u ON l.wa_id = u.wa_id
ORDER BY l.created_at DESC
LIMIT 20;
```

---

## 6. Spesifikasi Modul Inti & API

### A. `src/lib/sticker-processor.ts`
- **Input:** `inputBuffer: Buffer`, `options?: { topText?: string; bottomText?: string; cropSquare?: boolean }`
- **Proses:**
  1. Resize gambar ke `512x512` (`fit: cropSquare ? 'cover' : 'contain'`, background transparan `{ r: 0, g: 0, b: 0, alpha: 0 }`).
  2. Jika `topText` atau `bottomText` ada, buat overlay SVG `512x512` (teks putih tebal dengan stroke hitam ala meme, pastikan karakter spesial XML `& < > " '` di-escape agar SVG tidak crash) lalu gabungkan menggunakan `.composite()`.
  3. Konversi ke `.webp` mulai dari `quality: 80`. Jika `buffer.length > 98 * 1024` (98 KB), ulangi kompresi dengan menurunkan `quality` (65 -> 50 -> 35 -> 20) sampai memenuhi batas di bawah 100 KB.
- **Output:** `{ buffer: Buffer; sizeKb: number }`

### B. Endpoints API
| Endpoint | Method | Fungsi |
| :--- | :--- | :--- |
| `/api/webhook` | `GET` | Verifikasi webhook Meta (`hub.mode`, `hub.verify_token`, `hub.challenge`). |
| `/api/webhook` | `POST` | Validasi signature, terima pesan gambar/teks WA, jalankan proses stiker di `after()`. |
| `/api/sticker` | `POST` | Terima `FormData` (`file`, `topText`, `bottomText`, `cropSquare`), proses dengan `sharp`, catat log `source: 'web'` ke Supabase, kembalikan binary `image/webp`. |
| `/api/stats` | `GET` | Ambil ringkasan total stiker, jumlah user unik WA, rata-rata latency, data `dashboard_daily_stats` (7–14 hari terakhir), dan `dashboard_recent_activity`. |

---

## 7. Environment Variables (`.env.local`)

```env
# Meta WhatsApp Cloud API
WHATSAPP_TOKEN=""
WHATSAPP_PHONE_NUMBER_ID=""
WHATSAPP_VERIFY_TOKEN=""
WHATSAPP_APP_SECRET=""
WHATSAPP_API_VERSION="v21.0"

# Supabase
NEXT_PUBLIC_SUPABASE_URL=""
NEXT_PUBLIC_SUPABASE_ANON_KEY=""
SUPABASE_SERVICE_ROLE_KEY=""
```

---

## 8. Roadmap Eksekusi untuk Agent (Antigravity Checklist)

Gunakan tahapan ini saat memberikan prompt ke agent di Antigravity agar kode bersih dan terverifikasi di setiap langkah:

- [ ] **Phase 1: Project Setup & Dependencies**
  - Inisialisasi Next.js (App Router, TypeScript, Tailwind CSS, `src/`).
  - Install dependencies: `sharp`, `@supabase/supabase-js`, `lucide-react`, `recharts`.
  - Konfigurasi `next.config.ts` (`serverExternalPackages: ['sharp']`) dan buat `.env.example`.
- [ ] **Phase 2: Core Libraries & Types**
  - Buat `src/types/whatsapp.ts` dan `src/types/database.ts`.
  - Buat `src/lib/supabase.ts`, `src/lib/signature.ts`, `src/lib/sticker-processor.ts`, dan `src/lib/whatsapp.ts`.
- [ ] **Phase 3: Backend API Routes**
  - Implementasi `src/app/api/webhook/route.ts` (gunakan `export const runtime = 'nodejs'`).
  - Implementasi `src/app/api/sticker/route.ts` dan `src/app/api/stats/route.ts`.
- [ ] **Phase 4: Frontend UI (Web Maker & Dashboard)**
  - Buat `Navbar.tsx` dan halaman `/` (`StickerUploader.tsx`) lengkap dengan preview stiker kotak transparan (checkerboard background), toggle crop/contain, input teks atas-bawah, dan tombol download `.webp`.
  - Buat halaman `/dashboard` (`StatsCards.tsx`, `ActivityChart.tsx`, `RecentLogsTable.tsx`) dengan tombol refresh manual & tampilan responsif.
- [ ] **Phase 5: Local Verification & Deploy**
  - Jalankan `npm run build` dan pastikan 0 TypeScript/ESLint error.
  - Deploy ke Vercel, isi seluruh Environment Variables, jalankan SQL Supabase, dan hubungkan URL `/api/webhook` ke dashboard Meta Developer.