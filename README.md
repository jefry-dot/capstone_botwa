# WA AI Sticker Studio — WhatsApp Bot & Web Studio (Capstone Project)

Platform fullstack pembuat stiker WhatsApp (`512x512` WebP `< 100 KB`) berbasis **AI Vision (Google Gemini Flash)** dan **Dynamic SVG Template Engine (`sharp`)** yang berjalan di dua kanal sekaligus (**WhatsApp Cloud API Bot** & **Web Studio**) lengkap dengan **Live Telemetry Dashboard**.

## Fitur Utama (5 Mode Stiker)

1. **Standard & Smart Crop (`/stiker`, `/crop`)** — Konversi foto ke stiker WebP transparan (`contain`) atau kotak penuh 1:1 (`cover`).
2. **Classic Meme Generator (`/stiker Teks Atas | Teks Bawah`)** — Tambah teks meme kapital tebal dengan garis tepi hitam.
3. **AI Vision Auto-Meme & Roast (`/aimeme`, `/roast`)** — Gemini Flash menganalisis isi foto dan otomatis membuatkan caption komedi situasi atau roasting santai.
4. **Fake Chat / Quote Bubble (`/qc <teks>`)** — Render stiker bubble chat WhatsApp Dark Mode lengkap dengan avatar inisial, jam WIB, dan centang dua biru tanpa perlu mengirim foto.
5. **Viral Typography & Frame (`/brat <teks>`, `/news <headline>`)** — Stiker teks hijau khas *Brat* dengan efek low-fi blur atau bingkai foto ala siaran televisi *LIVE Breaking News*.

## Cara Menjalankan secara Lokal

1. **Jalankan Skema SQL Supabase:**
   Buka **Supabase SQL Editor**, lalu jalankan seluruh isi file [`supabase/schema.sql`](./supabase/schema.sql).
2. **Isi Environment Variables:**
   Lengkapi variabel di file `.env.local` (lihat template di [`.env.example`](./.env.example)).
3. **Jalankan Server Development:**
   ```bash
   npm install
   npm run dev
   ```
   Buka `http://localhost:3000` untuk **Web Sticker Studio** dan `http://localhost:3000/dashboard` untuk **Live Telemetry Dashboard**.
