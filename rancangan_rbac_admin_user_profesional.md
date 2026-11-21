# Rancangan Arsitektur Profesional: RBAC (Admin Login vs Public User), Rate Limiting & Bot Control Panel

> **Status Dokumen:** Blueprint Upgrade Arsitektur (v3.0 — Production-Grade)  
> **Prasyarat:** Seluruh perbaikan di `rancangan_perbaikan_bug_audit_stabilitas.md` telah lulus `tsc`, `lint`, dan `build`.  
> **Target Biaya:** Tetap **100% Free Tier (Rp 0)** menggunakan Supabase Auth + PostgreSQL + Next.js Middleware di Vercel.

---

## 1. Filosofi Akses: Zero-Friction User vs Secured Admin

Pada aplikasi layanan publik profesional (SaaS / Bot Studio), memaksa user biasa untuk membuat akun hanya demi membuat satu stiker akan menurunkan *user experience*. Sebaliknya, membiarkan halaman monitoring telemetri (`/dashboard`) dan konfigurasi bot terbuka ke publik adalah celah keamanan serius.

Karena itu, sistem dibagi menjadi **2 peran akses yang tegas**:

| Aspek | Public User (Guest / Pengguna WA) | Administrator (`admin` / `super_admin`) |
| :--- | :--- | :--- |
| **Autentikasi** | **Tanpa Login** (langsung pakai) | **Wajib Login** (Email + Password via Supabase Auth + HttpOnly Cookie) |
| **Registrasi Mandiri** | Tidak diperlukan | **Dimatikan** (akun admin hanya dibuat via Supabase Dashboard / seed script agar publik tidak bisa mendaftar jadi admin) |
| **Akses Web** | `/` (Web Sticker Studio 5 Mode) & panduan Bot WA | `/admin/login`, `/admin/dashboard`, `/admin/users`, `/admin/settings`, `/admin/logs` |
| **Akses API** | `POST /api/sticker` (dibatasi *Rate Limit* harian), `POST /api/webhook` (khusus Meta signature) | `GET /api/stats`, `GET/PATCH /api/admin/users`, `GET/PATCH /api/admin/settings`, `GET /api/admin/export` |
| **Privasi Data** | Tidak pernah menerima data user lain atau statistik internal | Melihat analitik lengkap, manajemen blokir user spam, audit log, & export CSV laporan |

---

## 2. Arsitektur Keamanan (Defense in Depth)

Jangan pernah hanya menyembunyikan tombol menu di Navbar—proteksi wajib diterapkan di **3 lapisan sekaligus**:

```text
[Browser Request]
       │
       ├──> "/" atau "/api/sticker"
       │       └──> Public Access (Tanpa Login) + Cek Maintenance Mode + Rate Limiter (IP)
       │
       └──> "/admin/*" atau "/dashboard" atau "/api/stats" atau "/api/admin/*"
               │
               ├── Layer 1: Next.js Middleware (src/middleware.ts)
               │      - Cek session cookie Supabase (@supabase/ssr)
               │      - Jika belum login -> redirect ke /admin/login (halaman) atau 401 (API)
               │
               ├── Layer 2: Server-Side Role Verification (src/lib/auth.ts)
               │      - Validasi token lewat supabase.auth.getUser() (bukan getSession)
               │      - Cek tabel public.admin_profiles: pastikan user terdaftar & is_active = true
               │      - Jika bukan admin -> return 403 Forbidden
               │
               └── Layer 3: Database RLS (Supabase PostgreSQL)
                      - Tabel sensitif tetap terkunci RLS; mutasi admin dicatat di admin_audit_logs
```

### Mengapa Memakai Supabase Auth (`@supabase/ssr`) daripada Hardcode Password `.env`?
1. **Standar Industri untuk Sidang Capstone:** Mendemonstrasikan manajemen sesi berbasis JWT + `HttpOnly` cookie, rotasi refresh token otomatis, dan verifikasi RBAC di database.
2. **Multi-Admin Siap Pakai:** Bisa membuat akun terpisah untuk tiap anggota kelompok atau akun khusus dosen penguji saat demo tanpa membagikan kredensial utama.
3. **Nol Biaya Tambahan:** Sudah termasuk gratis di project Supabase yang sedang dipakai (limit 50.000 MAU di Free Tier).

---

## 3. Fitur Profesional di Portal Admin (`/admin/*`)

### A. Live Telemetry Dashboard (`/admin/dashboard`)
* Memindahkan halaman `/dashboard` yang sudah ada ke rute privat `/admin/dashboard` (dengan redirect otomatis `/dashboard` $\rightarrow$ `/admin/dashboard`).
* Dilindungi oleh `middleware.ts` dan verifikasi server-side di `GET /api/stats`.
* Menampilkan KPI Cards, grafik harian WA vs Web, popularitas 7 mode fitur, dan 20 aktivitas terbaru.

### B. Manajemen User WhatsApp & Moderasi Spam (`/admin/users`)
* Menampilkan daftar pengguna WhatsApp dari tabel `wa_users`: nama profil, nomor WA yang **di-mask secara default** (misal `62812****890` dengan tombol toggle "Tampilkan" agar aman saat presentasi layar penuh), total stiker, dan waktu terakhir aktif.
* **Fitur Block / Unblock User:** Admin dapat memblokir nomor pelaku spam beserta alasannya (`is_blocked`, `blocked_reason`).
* **Integrasi ke Webhook WA:** Begitu pesan masuk di `/api/webhook`, sistem mengecek status `is_blocked`. Jika diblokir, bot langsung menolak tanpa memanggil `sharp` atau Gemini API (hemat resource & kuota).

### C. Bot Control & Feature Flags (`/admin/settings`)
Admin dapat mengendalikan perilaku bot dan Web Studio secara *real-time* tanpa perlu deploy ulang Vercel:
* **Maintenance Mode (`maintenance_mode`):** Jika aktif, Web Studio menampilkan banner pemeliharaan dan bot WA otomatis membalas pesan sedang maintenance.
* **Kill-Switch AI Vision (`ai_enabled`):** Jika kuota harian Gemini menipis, admin cukup matikan fitur `/aimeme` & `/roast` dengan 1 klik sementara 4 mode lainnya (`/stiker`, `/crop`, `/qc`, `/brat`, `/news`) tetap jalan normal.
* **Kuota AI Harian Dinamis:**
  * `max_web_ai_per_ip_daily` (default: `5` kali/hari per IP untuk tamu Web Studio tanpa login).
  * `max_wa_ai_per_user_daily` (default: `10` kali/hari per nomor WA).

### D. Log Error Detail & Export CSV (`/admin/logs` & `/api/admin/export`)
* Tabel log dengan filter berdasarkan **Kanal** (`whatsapp`/`web`), **Status** (`success`/`failed`), dan **Mode Stiker** (`command_type`), termasuk kolom `error_message` untuk debugging cepat.
* **Tombol Export CSV:** Mengunduh rekap data telemetri (`created_at`, `source`, `command_type`, `status`, `processing_time_ms`, `file_size_kb`) dalam format `.csv` siap olah di Excel — sangat berguna untuk bukti data pengujian Bab 4 di laporan Capstone.

---

## 4. Pembaruan UI & Navigasi (Pemisahan Tampilan User vs Admin)

* **Navbar Publik (`/`):**
  * Hanya menampilkan brand **WA AI Sticker Studio**, navigasi **Sticker Studio**, dan tombol minimalis **Portal Admin** (ikon gembok kecil di kanan atas menuju `/admin/login`).
  * Jika browser sudah memiliki sesi login admin yang aktif, tombol berubah menjadi **Admin Panel** (`/admin/dashboard`).
* **Layout Khusus Admin (`src/app/admin/(protected)/layout.tsx`):**
  * Menggunakan **Sidebar / Sub-navbar khusus Admin** berisi 4 menu utama:
    1. `Dashboard` (`/admin/dashboard`)
    2. `Manajemen User` (`/admin/users`)
    3. `Kontrol Bot & Kuota` (`/admin/settings`)
    4. `Log & Export` (`/admin/logs`)
  * Dilengkapi info email admin yang sedang login, badge role (`SUPER ADMIN` / `ADMIN`), tombol kembali ke Web Studio (`/`), dan tombol **Logout** (`POST /api/auth/logout`).
* **Halaman Login Admin (`/admin/login`):**
  * Form bersih & profesional (Email + Password) tanpa tombol "Daftar/Register", dengan keterangan singkat *"Akses khusus administrator sistem. Pengguna umum dapat langsung membuat stiker di Web Studio tanpa login."*

---

## 5. Migrasi Skema Database (`supabase/rbac_migration.sql`)

Tambahan tabel dan kolom yang bersifat non-destruktif (aman dijalankan di atas `supabase/schema.sql` yang sudah ada):

```sql
-- ============================================================================
-- 1. Tabel Profil Admin (RBAC) terhubung ke Supabase Auth (auth.users)
-- ============================================================================
CREATE TABLE IF NOT EXISTS public.admin_profiles (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  email TEXT NOT NULL UNIQUE,
  full_name TEXT NOT NULL DEFAULT 'Administrator',
  role TEXT NOT NULL DEFAULT 'admin' CHECK (role IN ('super_admin', 'admin')),
  is_active BOOLEAN NOT NULL DEFAULT TRUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE public.admin_profiles ENABLE ROW LEVEL SECURITY;

-- ============================================================================
-- 2. Tambah Kolom Moderasi (Block/Unblock) di wa_users
-- ============================================================================
ALTER TABLE public.wa_users
  ADD COLUMN IF NOT EXISTS is_blocked BOOLEAN NOT NULL DEFAULT FALSE,
  ADD COLUMN IF NOT EXISTS blocked_reason TEXT,
  ADD COLUMN IF NOT EXISTS blocked_at TIMESTAMPTZ;

-- ============================================================================
-- 3. Tabel Konfigurasi Bot & Feature Flags (Single Row Config)
-- ============================================================================
CREATE TABLE IF NOT EXISTS public.bot_settings (
  id INTEGER PRIMARY KEY DEFAULT 1 CHECK (id = 1),
  maintenance_mode BOOLEAN NOT NULL DEFAULT FALSE,
  maintenance_message TEXT NOT NULL DEFAULT 'Sistem sedang dalam pemeliharaan singkat. Silakan coba beberapa menit lagi.',
  ai_enabled BOOLEAN NOT NULL DEFAULT TRUE,
  max_web_ai_per_ip_daily INTEGER NOT NULL DEFAULT 5 CHECK (max_web_ai_per_ip_daily >= 0),
  max_wa_ai_per_user_daily INTEGER NOT NULL DEFAULT 10 CHECK (max_wa_ai_per_user_daily >= 0),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_by UUID REFERENCES public.admin_profiles(id) ON DELETE SET NULL
);

INSERT INTO public.bot_settings (id)
VALUES (1)
ON CONFLICT (id) DO NOTHING;

ALTER TABLE public.bot_settings ENABLE ROW LEVEL SECURITY;

-- ============================================================================
-- 4. Tabel Rate Limiting Harian (Untuk Guest Web via IP & User WA via wa_id)
-- ============================================================================
CREATE TABLE IF NOT EXISTS public.ai_rate_limits (
  identifier TEXT NOT NULL,           -- Format: 'web:<hashed_ip>' atau 'wa:<wa_id>'
  usage_date DATE NOT NULL DEFAULT (NOW() AT TIME ZONE 'Asia/Jakarta')::DATE,
  request_count INTEGER NOT NULL DEFAULT 1,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  PRIMARY KEY (identifier, usage_date)
);

ALTER TABLE public.ai_rate_limits ENABLE ROW LEVEL SECURITY;

-- Fungsi atomik untuk cek & increment kuota harian AI
CREATE OR REPLACE FUNCTION public.consume_ai_quota(
  p_identifier TEXT,
  p_max_limit INTEGER
)
RETURNS TABLE (allowed BOOLEAN, current_count INTEGER, remaining INTEGER) AS $$
DECLARE
  v_today DATE := (NOW() AT TIME ZONE 'Asia/Jakarta')::DATE;
  v_count INTEGER;
BEGIN
  IF p_max_limit <= 0 THEN
    RETURN QUERY SELECT FALSE, 0, 0;
    RETURN;
  END IF;

  INSERT INTO public.ai_rate_limits (identifier, usage_date, request_count, updated_at)
  VALUES (p_identifier, v_today, 1, NOW())
  ON CONFLICT (identifier, usage_date)
  DO UPDATE SET
    request_count = CASE
      WHEN public.ai_rate_limits.request_count < p_max_limit
        THEN public.ai_rate_limits.request_count + 1
      ELSE public.ai_rate_limits.request_count
    END,
    updated_at = NOW()
  RETURNING public.ai_rate_limits.request_count INTO v_count;

  -- Cek apakah benar-benar melewati limit sebelum increment
  IF v_count >= p_max_limit THEN
    -- Pastikan cek apakah masih ada kuota atau sudah penuh
    RETURN QUERY SELECT (v_count <= p_max_limit), v_count, GREATEST(0, p_max_limit - v_count);
  ELSE
    RETURN QUERY SELECT TRUE, v_count, GREATEST(0, p_max_limit - v_count);
  END IF;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ============================================================================
-- 5. Tabel Audit Trail Aksi Admin
-- ============================================================================
CREATE TABLE IF NOT EXISTS public.admin_audit_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  admin_id UUID REFERENCES public.admin_profiles(id) ON DELETE SET NULL,
  admin_email TEXT NOT NULL,
  action TEXT NOT NULL,               -- contoh: 'UPDATE_SETTINGS', 'BLOCK_USER', 'UNBLOCK_USER', 'EXPORT_CSV'
  target TEXT,                        -- contoh: 'wa_id:62812xxxx' atau 'bot_settings'
  details JSONB,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_admin_audit_logs_created_at
  ON public.admin_audit_logs (created_at DESC);

ALTER TABLE public.admin_audit_logs ENABLE ROW LEVEL SECURITY;
```

> **Catatan Implementasi `consume_ai_quota`:** Pada saat implementasi, disarankan mengecek `SELECT request_count` terlebih dahulu di dalam transaksi atau mengembalikan flag eksplisit `was_incremented` agar request ke-`N+1` ditolak secara presisi (`HTTP 429 Too Many Requests` di Web / pesan ramah kuota habis di WA).

---

## 6. Perubahan & Penambahan Struktur File

```text
capstone_botwa/
├── supabase/
│   ├── schema.sql
│   └── rbac_migration.sql                    # [BARU] Tabel admin_profiles, bot_settings, rate_limits, audit_logs
└── src/
    ├── middleware.ts                         # [BARU] Proteksi rute /admin/*, /dashboard, & API privat
    ├── lib/
    │   ├── supabase-server.ts                # [BARU] Server client @supabase/ssr berbasis cookie
    │   ├── auth.ts                           # [BARU] Helper requireAdmin() untuk API Route & Server Component
    │   ├── bot-config.ts                     # [BARU] Loader bot_settings + helper cek kuota AI & blokir user
    │   └── supabase.ts                       # [TETAP] supabaseAdmin (service_role)
    ├── types/
    │   └── admin.ts                          # [BARU] Tipe AdminProfile, BotSettings, AuditLog, ManagedWaUser
    ├── components/
    │   ├── Navbar.tsx                        # [REVISI] Navbar publik bersih + tombol Portal Admin
    │   └── admin/
    │       ├── AdminSidebar.tsx              # [BARU] Navigasi portal admin + tombol Logout
    │       ├── UsersTable.tsx                # [BARU] Tabel user WA + mask nomor + toggle Block/Unblock
    │       └── SettingsForm.tsx              # [BARU] Form toggle Maintenance, AI Vision, & Limit Kuota
    └── app/
        ├── dashboard/
        │   └── page.tsx                      # [REVISI] Redirect otomatis ke /admin/dashboard
        ├── admin/
        │   ├── login/
        │   │   └── page.tsx                  # [BARU] Halaman Login khusus Admin
        │   └── (protected)/
        │       ├── layout.tsx                # [BARU] Server-side guard requireAdmin() + AdminSidebar
        │       ├── dashboard/page.tsx        # [BARU] Live Telemetry Dashboard (privat)
        │       ├── users/page.tsx            # [BARU] Moderasi User WhatsApp
        │       ├── settings/page.tsx         # [BARU] Kontrol Bot & Kuota AI
        │       └── logs/page.tsx             # [BARU] Log detail error + Export CSV
        └── api/
            ├── auth/
            │   ├── login/route.ts            # [BARU] POST login email/password + validasi admin_profiles
            │   └── logout/route.ts           # [BARU] POST hapus session cookie
            ├── stats/route.ts                # [REVISI] Tambahkan guard requireAdmin()
            ├── sticker/route.ts              # [REVISI] Cek maintenance_mode, ai_enabled, & rate limit IP
            ├── webhook/route.ts              # [REVISI] Cek is_blocked, maintenance_mode, ai_enabled, & kuota WA
            └── admin/
                ├── users/route.ts            # [BARU] GET list user WA & PATCH block/unblock + audit log
                ├── settings/route.ts         # [BARU] GET & PATCH bot_settings + audit log
                ├── logs/route.ts             # [BARU] GET log dengan filter & error_message
                └── export/route.ts           # [BARU] GET download laporan telemetry CSV
```

---

## 7. Dependencies & Setup Awal

1. **Install 1 package resmi Supabase SSR:**
   ```bash
   npm install @supabase/ssr
   ```
2. **Buat Akun Admin Pertama (Manual 1x di Supabase Dashboard):**
   * Buka **Supabase Dashboard → Authentication → Users → Add user → Create new user** (masukkan email & password admin, centang *Auto Confirm User*).
   * Salin `User UID` yang terbuat, lalu jalankan 1 baris SQL ini di SQL Editor:
     ```sql
     INSERT INTO public.admin_profiles (id, email, full_name, role)
     VALUES ('<PASTE_USER_UID_DISINI>', 'admin@kampus.ac.id', 'Super Admin', 'super_admin');
     ```
   * Nonaktifkan *Allow new users to sign up* di **Authentication → Providers → Email** agar tidak ada pendaftaran liar dari publik.

---

## 8. Roadmap Eksekusi Bertahap (Prompt Siap Pakai untuk Antigravity)

Bagi pengerjaan ke dalam **4 tahap kecil** agar kode rapi dan hemat token:

### Phase A — Database, Dependencies & Core Auth Guard
```text
Baca `rancangan_rbac_admin_dan_user.md` dan kerjakan HANYA Phase A (Database, Auth Guard & Middleware).

Tugas:
1. Install `@supabase/ssr`.
2. Buat file `supabase/rbac_migration.sql` sesuai spesifikasi (perbaiki logika `consume_ai_quota` agar akurat menolak request ke-(N+1) dengan transaksi/locking yang aman).
3. Buat `src/types/admin.ts`, `src/lib/supabase-server.ts`, `src/lib/auth.ts` (fungsi `getCurrentAdmin()` dan `requireAdmin()`), serta `src/lib/bot-config.ts` (helper ambil `bot_settings`, cek status blokir user WA, dan cek/konsumsi kuota AI dengan hashing IP pakai SHA-256).
4. Buat `src/middleware.ts` untuk memproteksi rute `/admin/*` (kecuali `/admin/login`), `/dashboard`, `/api/stats`, dan `/api/admin/*`.
5. Buat `src/app/api/auth/login/route.ts` dan `src/app/api/auth/logout/route.ts`.

Jalankan `npx tsc --noEmit` setelah selesai dan laporkan file yang dibuat.
```

### Phase B — Proteksi API Existing & Endpoint Admin Baru
```text
Lanjutkan ke Phase B berdasarkan `rancangan_rbac_admin_dan_user.md`. Fokus HANYA pada folder `src/app/api/`.

Tugas:
1. Update `src/app/api/stats/route.ts`: wajib panggil `requireAdmin()` di awal handler (return 401/403 jika bukan admin).
2. Update `src/app/api/sticker/route.ts` & `src/app/api/webhook/route.ts`:
   - Cek `maintenance_mode` dari `bot_settings`.
   - Di webhook: cek `is_blocked` user WA sebelum memproses pesan.
   - Untuk mode `ai_meme`/`roast`: cek `ai_enabled` dan kuota harian via `bot-config.ts` (return 429 dengan pesan jelas di Web, atau balas pesan kuota habis di WA).
3. Buat endpoint admin baru (semua wajib `requireAdmin()` + catat mutasi ke `admin_audit_logs`):
   - `src/app/api/admin/users/route.ts` (GET list `wa_users` & PATCH block/unblock)
   - `src/app/api/admin/settings/route.ts` (GET & PATCH `bot_settings`)
   - `src/app/api/admin/logs/route.ts` (GET log lengkap dengan filter source/status/command_type)
   - `src/app/api/admin/export/route.ts` (GET streaming file `telemetry-report.csv` dengan sanitasi formula CSV)

Jalankan `npx tsc --noEmit` setelah selesai.
```

### Phase C — UI Login Admin, Layout Terproteksi & Pembersihan Navbar Publik
```text
Lanjutkan ke Phase C berdasarkan `rancangan_rbac_admin_dan_user.md`.

Tugas:
1. Update `src/components/Navbar.tsx`: hapus menu Live Dashboard untuk publik, ganti dengan tombol halus "Portal Admin" menuju `/admin/login` (atau "Admin Panel" jika sudah login). Update juga tombol di `src/app/page.tsx` agar tidak membingungkan user publik.
2. Buat halaman login bersih di `src/app/admin/login/page.tsx`.
3. Buat `src/components/admin/AdminSidebar.tsx` dan `src/app/admin/(protected)/layout.tsx` (wajib cek `getCurrentAdmin()` di server component dan redirect ke `/admin/login` jika tidak valid).
4. Pindahkan halaman dashboard ke `src/app/admin/(protected)/dashboard/page.tsx` dan ubah `src/app/dashboard/page.tsx` menjadi server redirect ke `/admin/dashboard`.

Jalankan `npx tsc --noEmit` setelah selesai.
```

### Phase D — Halaman Moderasi User, Kontrol Bot, Log Export & Final Audit
```text
Lanjutkan ke Phase D (Tahap Akhir) berdasarkan `rancangan_rbac_admin_dan_user.md`.

Tugas:
1. Buat `src/components/admin/UsersTable.tsx` + `src/app/admin/(protected)/users/page.tsx` (tampilkan daftar user WA, masking nomor default dengan tombol toggle lihat, dan modal/tombol Block & Unblock).
2. Buat `src/components/admin/SettingsForm.tsx` + `src/app/admin/(protected)/settings/page.tsx` (toggle Maintenance Mode, toggle AI Vision, dan input kuota harian Web/WA).
3. Buat `src/app/admin/(protected)/logs/page.tsx` (filter kanal/status/mode, detail error_message, dan tombol Download CSV).
4. Jalankan verifikasi akhir: `npx tsc --noEmit && npm run lint && npm run build` hingga 0 error.
```