# Rancangan Perbaikan Bug & Audit Stabilitas (Pre-Production Fix)

> **Status Dokumen:** Audit & Rencana Perbaikan Bug (v2.0.1)  
> **Target Repositori:** `capstone_botwa`  
> **Tujuan:** Menutup seluruh *critical bug*, mencegah crash saat deploy ke Vercel, dan memastikan `tsc`, `lint`, serta `next build` lolos 100% sebelum masuk ke fase pengembangan fitur profesional (RBAC Admin & User).

---

## 1. Ringkasan Temuan Audit Kode

| ID | Prioritas | File Terdampak | Masalah Utama | Dampak |
| :--- | :---: | :--- | :--- | :--- |
| **BUG-01** | **P0 (Kritis)** | `supabase/schema.sql` | Constraint `command_type` masih v1.0 (3 mode) & view `dashboard_feature_stats` belum ada | `/dashboard` langsung error 500; log untuk `/aimeme`, `/qc`, `/brat`, `/news` gagal masuk DB |
| **BUG-02** | **P0 (Kritis)** | `src/lib/sticker-processor.ts`, `next.config.ts` | Render teks SVG mengandalkan font sistem yang tidak ada di container Linux Vercel | Teks stiker `/qc`, `/brat`, `/news`, dan meme berubah jadi kotak-kotak (`□□□`) saat live |
| **BUG-03** | **P1 (Tinggi)** | `src/app/api/webhook/route.ts`, `src/app/api/sticker/route.ts` | Belum ada `export const maxDuration = 60` | Fitur AI Vision (`/aimeme`, `/roast`) rawan kena *timeout* 10 detik di Vercel |
| **BUG-04** | **P1 (Tinggi)** | `package.json` | Script `"lint": "next lint"` ada, tapi `eslint` & `eslint-config-next` belum terinstall | Command `npm run lint` gagal saat verifikasi CI/CD atau deploy |
| **BUG-05** | **P2 (Menengah)** | `src/components/StickerUploader.tsx` | Double `URL.revokeObjectURL()` di updater `setState` dan cleanup `useEffect` | Preview foto / hasil stiker rawan *broken image* di React 19 Strict Mode |
| **BUG-06** | **P2 (Menengah)** | `src/app/api/webhook/route.ts`, `supabase/schema.sql` | Belum ada deduplikasi `message.id` dari webhook Meta | Retry webhook Meta bisa bikin bot kirim 2 stiker kembar & boros kuota Gemini |
| **BUG-07** | **P2 (Menengah)** | `src/lib/whatsapp.ts`, `src/app/api/sticker/route.ts`, `src/types/database.ts`, `src/app/dashboard/page.tsx` | Env `WHATSAPP_API_VERSION` diabaikan, validasi `meme_text` kosong belum ada, dan Client Component import tipe dari file API Route | Konfigurasi tidak sinkron & batas layer arsitektur kurang bersih |

---

## 2. Detail Teknis & Spesifikasi Perbaikan

### BUG-01 (P0): Sinkronisasi `supabase/schema.sql` ke v2.0 + Deduplikasi
- **Akar Masalah:** File `supabase/schema.sql` belum diperbarui mengikuti `rancangan_revisi_dan_fitur_pembeda.md`. Tabel `sticker_logs` masih membatasi `command_type` ke `('standard', 'meme_text', 'crop')` dan view `dashboard_feature_stats` belum dibuat.
- **Rencana Perbaikan:**
  1. Perbarui `CHECK` constraint `command_type` agar menerima seluruh 7 nilai: `'standard'`, `'crop'`, `'meme_text'`, `'ai_meme'`, `'quote_chat'`, `'brat_text'`, `'breaking_news'`.
  2. Sertakan statement migrasi aman (`ALTER TABLE ... DROP CONSTRAINT IF EXISTS` lalu `ADD CONSTRAINT`) agar tidak error jika tabel sudah terlanjur dibuat di Supabase.
  3. Tambahkan kolom opsional `wa_message_id TEXT UNIQUE` pada `sticker_logs` (untuk mendukung solusi BUG-06) beserta index `idx_sticker_logs_command_type`.
  4. Tambahkan view `public.dashboard_feature_stats` sesuai query yang dipanggil oleh `src/app/api/stats/route.ts`.
  5. **Tindakan Manual Wajib:** Jalankan ulang isi `supabase/schema.sql` di **Supabase SQL Editor**.

### BUG-02 (P0): Bundling Font untuk SVG Rendering (`sharp`) di Vercel
- **Akar Masalah:** `sharp` menggunakan `librsvg`/`fontconfig` bawaan OS untuk me-raster `<text>` pada SVG. Container Linux Vercel sangat minimal dan sering tidak menyediakan font `Impact`, `Arial`, atau `DejaVu Sans`, sehingga teks pada `/qc`, `/brat`, `/news`, dan `/aimeme` bisa gagal ter-render.
- **Rencana Perbaikan:**
  1. Buat folder `fonts/` di root project dan masukkan minimal 2 file font `.ttf` open-source yang ringan (misal `Inter-Regular.ttf`, `Inter-Bold.ttf`, atau `NotoSans-Regular.ttf`, `NotoSans-Bold.ttf` — bisa diambil dari Google Fonts).
  2. Buat file konfigurasi `fonts/fonts.conf` yang menunjuk direktori `./fonts` agar `fontconfig` otomatis membaca font lokal.
  3. Di `src/lib/sticker-processor.ts`, set environment fontconfig di level modul sebelum `sharp` memproses SVG (misal `process.env.FONTCONFIG_PATH = path.join(process.cwd(), "fonts")`) dan gunakan `font-family` yang sesuai dengan nama font yang dibundel sebagai prioritas utama.
  4. Di `next.config.ts`, tambahkan `outputFileTracingIncludes` untuk menyertakan folder `./fonts/**/*` ke dalam bundle serverless function `/api/webhook` dan `/api/sticker`.

```ts
// Referensi konfigurasi next.config.ts
import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  serverExternalPackages: ["sharp"],
  outputFileTracingIncludes: {
    "/api/webhook": ["./fonts/**/*"],
    "/api/sticker": ["./fonts/**/*"],
  },
};

export default nextConfig;
```

### BUG-03 (P1): Konfigurasi `maxDuration` untuk Route AI Vision
- **Akar Masalah:** Alur `/aimeme` dan `/roast` melibatkan beberapa panggilan jaringan berurutan (Meta Media Lookup → Download Foto → Gemini Vision API → Sharp Render → Upload Media → Send Message) yang dapat melampaui default timeout 10 detik Vercel.
- **Rencana Perbaikan:**
  - Tambahkan `export const maxDuration = 60;` tepat di bawah `export const runtime = "nodejs";` pada:
    - `src/app/api/webhook/route.ts`
    - `src/app/api/sticker/route.ts`

### BUG-04 (P1): Perbaikan Setup ESLint
- **Akar Masalah:** `package.json` mendeklarasikan `"lint": "next lint"`, tetapi paket `eslint` dan `eslint-config-next` belum terpasang di `devDependencies`.
- **Rencana Perbaikan:**
  - Install `eslint` dan `eslint-config-next` sebagai `devDependencies`:
    ```bash
    npm install -D eslint eslint-config-next
    ```
  - Buat file konfigurasi `eslint.config.mjs` (flat config standar Next.js 15) dan verifikasi `npm run lint` berjalan tanpa error.

### BUG-05 (P2): Perbaikan Lifecycle Object URL di `StickerUploader.tsx`
- **Akar Masalah:** `URL.revokeObjectURL` dipanggil di dalam fungsi updater `setPreviewUrl((prev) => ...)` dan `setResult((prev) => ...)` sekaligus di cleanup `useEffect`. Pada React 19 Strict Mode, fungsi updater dijalankan dua kali sehingga URL yang masih dipakai dapat langsung ter-revoke (*broken image*).
- **Rencana Perbaikan:**
  - Hapus pemanggilan `URL.revokeObjectURL` dari dalam `setPreviewUrl` dan `setResult`.
  - Biarkan cleanup `useEffect([previewUrl])` dan `useEffect([result])` yang menangani pembersihan memori secara murni dan aman.

### BUG-06 (P2): Deduplikasi `message.id` di Webhook WhatsApp
- **Akar Masalah:** Meta Cloud API menerapkan mekanisme *at-least-once delivery*. Jika ada keterlambatan jaringan, webhook dengan `message.id` yang sama bisa terkirim lebih dari sekali, memicu pengiriman stiker ganda dan pemanggilan Gemini API berulang.
- **Rencana Perbaikan:**
  - Di `src/app/api/webhook/route.ts`, tambahkan mekanisme pengecekan duplikat sebelum memproses pesan masuk:
    1. **Layer Cepat (In-Memory TTL Set):** Simpan `message.id` yang sedang/baru diproses di dalam `Map<string, number>` (dengan pembersihan otomatis entri lebih tua dari 5 menit) untuk menahan retry instan pada instance yang sama.
    2. **Layer Persisten (Supabase):** Simpan `wa_message_id: message.id` saat insert ke `sticker_logs`, dan cek keberadaan `wa_message_id` sebelum menjalankan alur berat seperti Gemini Vision.

### BUG-07 (P2): Sinkronisasi Env, Validasi Input & Pemisahan Layer Tipe
- **Rencana Perbaikan:**
  1. **`src/lib/whatsapp.ts`:** Ganti konstanta hardcode `"v21.0"` menjadi `process.env.WHATSAPP_API_VERSION || "v21.0"`.
  2. **`src/app/api/sticker/route.ts`:** Pada `case "meme_text"`, tambahkan validasi bahwa minimal salah satu dari `topText` atau `bottomText` harus diisi; jika keduanya kosong, kembalikan HTTP `400` dengan pesan yang jelas.
  3. **`src/types/database.ts` & `src/app/dashboard/page.tsx`:** Pindahkan interface `DashboardStatsResponse` dari `src/app/api/stats/route.ts` ke `src/types/database.ts`, lalu ubah import di `src/app/api/stats/route.ts` dan `src/app/dashboard/page.tsx` agar mengambil dari `@/types/database`.

---

## 3. Roadmap Eksekusi Perbaikan (Checklist)

Kerjakan berurutan agar setiap tahap bisa langsung diverifikasi:

- [x] **Step 1 — Database & Config (BUG-01, BUG-03, BUG-04)**
  - Update `supabase/schema.sql` dan jalankan ulang di Supabase SQL Editor.
  - Tambah `maxDuration = 60` di `/api/webhook/route.ts` dan `/api/sticker/route.ts`.
  - Install `eslint` & `eslint-config-next`, lalu buat `eslint.config.mjs`.
- [x] **Step 2 — Reliability & Cleanliness (BUG-05, BUG-06, BUG-07)**
  - Hapus double-revoke di `src/components/StickerUploader.tsx`.
  - Tambah deduplikasi `message.id` di `src/app/api/webhook/route.ts`.
  - Sinkronkan `WHATSAPP_API_VERSION` di `src/lib/whatsapp.ts`, tambah validasi `meme_text` di `/api/sticker/route.ts`, dan pindahkan `DashboardStatsResponse` ke `src/types/database.ts`.
- [x] **Step 3 — Font Bundling untuk Vercel (BUG-02)**
  - Siapkan folder `fonts/` (font `.ttf` + `fonts.conf`).
  - Update `next.config.ts` (`outputFileTracingIncludes`) dan `src/lib/sticker-processor.ts` (`FONTCONFIG_PATH` + font family).
- [x] **Step 4 — Verification Gate (Wajib Lulus Sebelum Fitur Baru)**
  - Jalankan `npx tsc --noEmit` (0 error).
  - Jalankan `npm run lint` (0 error).
  - Jalankan `npm run build` (build sukses 100%).
  - Tes render lokal untuk minimal 1 mode teks (`/qc` atau `/brat`) dan 1 mode foto (`/news`) lalu pastikan file `.webp` hasil render berukuran `512x512` dan `< 100 KB`.

---

## 4. Prompt Siap Pakai untuk Antigravity (Hemat Token)

### Prompt Batch A — Fix Database, Timeout, UI Bug & Deduplikasi (Step 1 & 2)
```text
Baca file `rancangan_perbaikan_bug.md` dan kerjakan HANYA Step 1 dan Step 2 (BUG-01, BUG-03, BUG-04, BUG-05, BUG-06, BUG-07). Jangan ubah fitur yang sudah jalan di luar daftar bug tersebut.

Setelah selesai:
1. Jalankan `npx tsc --noEmit`.
2. Jalankan `npm run lint`.
3. Laporkan ringkasan file yang diubah dan hasil kedua command tersebut.
```

### Prompt Batch B — Fix Font SVG untuk Vercel & Final Build Audit (Step 3 & 4)
```text
Lanjutkan ke Step 3 dan Step 4 pada `rancangan_perbaikan_bug.md` (BUG-02 dan Verification Gate).

Tugas:
1. Siapkan konfigurasi `fonts/fonts.conf` serta unduh/pasang font open-source ringan (Noto Sans Regular & Bold .ttf) di folder `fonts/`.
2. Update `next.config.ts` (`outputFileTracingIncludes`) dan `src/lib/sticker-processor.ts` agar `sharp` menggunakan font lokal tersebut saat merender SVG.
3. Buat dan jalankan script verifikasi cepat untuk menguji `createQuoteBubbleSticker`, `createBratSticker`, dan `createBreakingNewsSticker` (cek format webp, dimensi 512x512, ukuran < 100KB).
4. Jalankan `npx tsc --noEmit && npm run lint && npm run build` hingga sukses 100%.
```