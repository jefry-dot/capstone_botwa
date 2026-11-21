# Rancangan Perbaikan & Revisi Blueprint: WhatsApp AI Sticker Bot & Web Studio

> **Status Dokumen:** Revisi & Pengayaan Fitur (v2.0)  
> **Referensi Utama:** `blueprint_project_bot_stiker_wa.md`  
> **Target Biaya:** Tetap **100% Free Tier (Rp 0)** (Vercel Hobby + Supabase Free + Meta Cloud API + Google Gemini API Free Tier)

---

## 1. Latar Belakang Revisi (Mengapa Perlu Fitur Pembeda?)

Aplikasi WhatsApp versi terbaru sudah memiliki fitur bawaan untuk mengubah foto dari galeri menjadi stiker biasa. Agar project Capstone ini memiliki **nilai jual akademik dan fungsional yang kuat (Unique Selling Proposition)** saat diuji, sistem tidak boleh hanya menjadi konverter gambar biasa, melainkan **AI-Powered & Template-Driven Sticker Studio** yang bekerja di dua kanal (WhatsApp Bot & Web).

### Tabel Perbandingan: Fitur Bawaan WhatsApp vs Project Capstone Ini

| Fitur / Kemampuan | Stiker Bawaan WhatsApp | Capstone WA Bot & Web Studio |
| :--- | :---: | :---: |
| Konversi Foto ke Stiker Biasa | ✅ Bisa | ✅ Bisa (`512x512` WebP `<100KB`) |
| **AI Auto-Meme & Roast dari Foto (`/aimeme`, `/roast`)** | ❌ Tidak Bisa | ✅ **Otomatis analisis isi foto dengan AI Vision** |
| **Fake Chat / Bubble Quote Sticker (`/qc`)** | ❌ Tidak Bisa | ✅ **Cukup ketik teks, langsung jadi stiker chat WA** |
| **Frame Siaran Berita TV (`/news`)** | ❌ Tidak Bisa | ✅ **Otomatis bingkai foto ala LIVE Breaking News** |
| **Text-to-Sticker Gaya Viral (`/brat`)** | ❌ Tidak Bisa | ✅ **Ketik teks langsung jadi stiker tipografi Brat** |
| **Akses Tanpa Install via Web Studio (`/`)** | ❌ Tidak Bisa | ✅ **Live Preview & Download langsung di Browser** |
| **Dashboard Analitik & Telemetry (`/dashboard`)** | ❌ Tidak Ada | ✅ **Monitoring Latency (ms), Ukuran KB, & Tren Fitur** |

---

## 2. Spesifikasi 5 Mode Stiker Unggulan

Seluruh mode di bawah ini diproses menggunakan kombinasi **`sharp` + Dynamic SVG Rendering + Gemini Flash Vision**, sehingga **tidak membutuhkan library berat** (tanpa Puppeteer/Canvas native) dan sangat aman dari limit memori/timeout serverless Vercel:

### Mode 1: Standard & Smart Crop (`/stiker` atau `/crop`)
- **Input:** Foto (tanpa caption, atau dengan caption `/stiker` / `/crop`).
- **Output:**
  - `/stiker`: Gambar utuh (`fit: 'contain'`) dengan padding transparan agar rasio foto tidak gepeng.
  - `/crop`: Gambar dipotong penuh kotak `512x512` (`fit: 'cover'`).

### Mode 2: Classic Meme Generator (`/stiker Teks Atas | Teks Bawah`)
- **Input:** Foto + caption dengan pemisah `|`.
- **Output:** Foto dengan overlay teks meme huruf kapital tebal (putih dengan *stroke* hitam tebal) di bagian atas dan bawah gambar.

### Mode 3: AI Vision Auto-Meme & Roast (`/aimeme` atau `/roast`) ⭐ *[Fitur AI Unggulan]*
- **Input:** Foto + caption `/aimeme` (komedi situasi) atau `/roast` (sindiran lucu/sarkas santai).
- **Alur Kerja:**
  1. Bot mengunduh gambar dari WhatsApp (atau menerima upload dari Web).
  2. Buffer gambar dikirim ke **Google Gemini Flash (`gemini-2.5-flash`)** untuk dianalisis secara visual (ekspresi wajah, objek, suasana).
  3. Gemini menghasilkan pasangan `{ topText, bottomText }` dalam bahasa Indonesia gaul/kontekstual (maksimal 5–6 kata per baris).
  4. `sharp` menggabungkan teks hasil AI tersebut ke dalam foto dan mengonversinya menjadi stiker `.webp` `<100KB`.

### Mode 4: Fake Chat / Quote Bubble Sticker (`/qc <teks>`) ⭐ *[Fitur Tanpa Foto]*
- **Input:** Hanya pesan teks `/qc Besok bimbingan jam 8 jangan kesiangan!` (bisa dari chat WA maupun form Web).
- **Alur Kerja:**
  1. Mengambil `profile_name` pengirim dari payload WhatsApp (atau input nama di Web) beserta jam saat ini (`WIB`).
  2. Merender kanvas SVG `512x512` transparan berisi komponen **Bubble Chat Dark Mode** lengkap dengan:
     - Avatar inisial nama berwarna otomatis,
     - Nama pengirim dengan warna khas grup WA,
     - Isi pesan multi-baris (*auto word-wrap*),
     - Jam pengiriman & ikon centang dua biru.
  3. Dikonversi oleh `sharp` menjadi stiker `.webp` transparan dalam waktu `< 50 ms`.

### Mode 5: Viral Frame & Typography (`/brat <teks>` & `/news <headline>`)
- **Sub-mode A — Brat Typography (`/brat <teks>`):**
  - **Input:** Hanya pesan teks, misal `/brat lagi pusing revisi bab 4`.
  - **Output:** Stiker kotak warna hijau khas *Brat* (`#8ACE00`) dengan susunan teks rata tengah/justifikasi bergaya *low-fi blur* yang langsung siap dipakai di chat.
- **Sub-mode B — Live Breaking News Frame (`/news <headline>`):**
  - **Input:** Foto + caption `/news Mahasiswa Ini Belum Tidur 2 Hari Demi Capstone`.
  - **Output:** Foto user dipasang sebagai latar, lalu ditumpuk dengan overlay SVG ala televisi:
    - Badge merah **"🔴 LIVE"** di pojok kanan atas,
    - Banner bawah **"BREAKING NEWS"** berwarna merah-putih-hitam lengkap dengan teks *headline* dari user dan jam siaran.

---

## 3. Revisi Arsitektur & Struktur File Codebase

Terdapat penambahan **1 file modul AI** (`src/lib/gemini.ts`) dan peningkatan fungsi pada file yang sudah ada:

```text
capstone_botwa/
├── blueprint_project_bot_stiker_wa.md
├── rancangan_revisi_dan_fitur_pembeda.md   # [BARU] Dokumen revisi & spesifikasi fitur pembeda
├── supabase/
│   └── schema.sql                          # [REVISI] Mendukung 7 kategori command_type
├── next.config.ts
├── .env.example                            # [REVISI] Tambah GEMINI_API_KEY
├── package.json
└── src/
    ├── app/
    │   ├── page.tsx                        # Web Sticker Studio (5 Mode Tab Interaktif)
    │   ├── dashboard/page.tsx              # Dashboard Monitoring + Statistik Popularitas Fitur
    │   └── api/
    │       ├── webhook/route.ts            # [REVISI] Handle pesan Image DAN pesan Text (/qc, /brat, /help)
    │       ├── sticker/route.ts            # [REVISI] Terima mode image maupun mode text-only dari Web
    │       └── stats/route.ts              # [REVISI] Sertakan breakdown pemakaian per command_type
    ├── components/
    │   ├── Navbar.tsx
    │   ├── StickerUploader.tsx             # [REVISI] Multi-mode UI (Photo, AI Meme, Quote Chat, Brat, News)
    │   ├── StatsCards.tsx
    │   ├── ActivityChart.tsx
    │   └── RecentLogsTable.tsx             # [REVISI] Badge warna-warni untuk tiap command_type
    ├── lib/
    │   ├── sticker-processor.ts            # [REVISI] Engine Sharp + 4 SVG Template Builders
    │   ├── gemini.ts                       # [BARU] Client Gemini Vision untuk Auto-Meme & Roast caption
    │   ├── whatsapp.ts
    │   ├── signature.ts
    │   └── supabase.ts
    └── types/
        ├── whatsapp.ts
        └── database.ts                     # [REVISI] Union type CommandType diperluas
```

---

## 4. Revisi Alur Logika Webhook WhatsApp (`POST /api/webhook`)

Pada blueprint lama, bot hanya memproses pesan bertipe `image`. Pada rancangan revisi ini, router perintah di dalam `after()` menangani **dua jenis pesan masuk**:

### A. Jika Pesan Masuk Bertipe `text`
1. **`/qc <teks>`** $\rightarrow$ Panggil `createQuoteBubbleSticker({ name, text, time })` $\rightarrow$ Upload & kirim balik sebagai stiker WA $\rightarrow$ Log ke Supabase (`command_type: 'quote_chat'`).
2. **`/brat <teks>`** $\rightarrow$ Panggil `createBratSticker({ text })` $\rightarrow$ Upload & kirim balik sebagai stiker WA $\rightarrow$ Log ke Supabase (`command_type: 'brat_text'`).
3. **`/help`, `menu`, atau teks biasa lainnya** $\rightarrow$ Balas pesan teks berisi daftar lengkap panduan 5 mode stiker beserta contoh penggunaannya.

### B. Jika Pesan Masuk Bertipe `image`
1. Download binary foto dari Meta Media API.
2. Cek prefix `caption`:
   - **`/aimeme` atau `/roast`** $\rightarrow$ Kirim buffer gambar ke `generateAiMemeCaption(buffer, mode)` di `src/lib/gemini.ts` untuk mendapatkan teks atas & bawah $\rightarrow$ Render dengan `processImageToSticker()` $\rightarrow$ Log (`command_type: 'ai_meme'`).
   - **`/news <headline>`** $\rightarrow$ Render foto dengan frame Breaking News (`command_type: 'breaking_news'`).
   - **`/crop`** $\rightarrow$ Render foto `512x512` mode `cover` (`command_type: 'crop'`).
   - **`/stiker Atas | Bawah` (atau caption berisi `|`)** $\rightarrow$ Render meme klasik (`command_type: 'meme_text'`).
   - **Tanpa caption / `/stiker`** $\rightarrow$ Render stiker standard transparan (`command_type: 'standard'`).
3. Upload `.webp` hasil olahan ke Meta Media API & kirim balik stiker ke pengirim.

---

## 5. Revisi Skema Database Supabase (`supabase/schema.sql`)

Bagian yang diperbarui dari skema sebelumnya:

1. **Perluasan Constraint `command_type` pada `public.sticker_logs`:**
   ```sql
   command_type TEXT NOT NULL DEFAULT 'standard' CHECK (
     command_type IN (
       'standard',
       'crop',
       'meme_text',
       'ai_meme',
       'quote_chat',
       'brat_text',
       'breaking_news'
     )
   )
   ```
2. **Penambahan View `public.dashboard_feature_stats`:**
   Digunakan untuk menampilkan fitur mana yang paling disukai user di halaman `/dashboard`:
   ```sql
   CREATE OR REPLACE VIEW public.dashboard_feature_stats AS
   SELECT
     command_type,
     COUNT(*) FILTER (WHERE status = 'success') AS total_used,
     ROUND(AVG(processing_time_ms) FILTER (WHERE status = 'success')) AS avg_process_ms
   FROM public.sticker_logs
   GROUP BY command_type
   ORDER BY total_used DESC;
   ```

---

## 6. Revisi Environment Variables (`.env.example`)

Menambahkan variabel kunci API Gemini (100% gratis dari [Google AI Studio](https://aistudio.google.com/)):

```env
# Meta WhatsApp Cloud API
WHATSAPP_TOKEN=""
WHATSAPP_PHONE_NUMBER_ID=""
WHATSAPP_VERIFY_TOKEN=""
WHATSAPP_APP_SECRET=""
WHATSAPP_API_VERSION="v21.0"

# Google Gemini AI (Free Tier - untuk fitur /aimeme & /roast)
GEMINI_API_KEY=""

# Supabase
NEXT_PUBLIC_SUPABASE_URL=""
NEXT_PUBLIC_SUPABASE_ANON_KEY=""
SUPABASE_SERVICE_ROLE_KEY=""
```

---

## 7. Roadmap Implementasi Revisi (Tahapan Eksekusi)

- [ ] **Tahap 0: Sinkronisasi Struktur & Skema**
  - Buat file placeholder `src/lib/gemini.ts`.
  - Update `supabase/schema.sql` dan `.env.example` sesuai rancangan revisi v2.0.
- [ ] **Tahap 1: Project Setup & Dependencies**
  - Setup Next.js App Router, Tailwind CSS, TypeScript.
  - Install `sharp`, `@supabase/supabase-js`, `@google/genai` (atau REST fetch ringan ke Gemini API), `lucide-react`, `recharts`.
- [ ] **Tahap 2: Core Sticker Engine (`sharp` + SVG Templates + Gemini Vision)**
  - Implementasi 5 mode di `src/lib/sticker-processor.ts` dan `src/lib/gemini.ts`.
- [ ] **Tahap 3: Backend API Routes (`/api/webhook`, `/api/sticker`, `/api/stats`)**
  - Implementasi handler pesan Gambar & Teks di Webhook WA serta endpoint Web Studio & Statistik.
- [ ] **Tahap 4: Web Sticker Studio (`/`) & Live Telemetry Dashboard (`/dashboard`)**
  - Buat UI pembuat stiker 5-mode dengan live preview dan halaman dashboard analitik real-time.
- [ ] **Tahap 5: Build Verification & Deployment**
  - Verifikasi `npm run build` dan push ke GitHub / Vercel.
