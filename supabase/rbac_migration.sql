-- ============================================================================
-- Migration Phase A: RBAC Admin, Bot Settings, Moderasi WA & AI Rate Limit
-- Jalankan di Supabase SQL Editor setelah supabase/schema.sql
-- ============================================================================

-- 1. Tabel Profil Admin (Terhubung ke auth.users milik Supabase Auth)
CREATE TABLE IF NOT EXISTS public.admin_profiles (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  email TEXT NOT NULL UNIQUE,
  full_name TEXT,
  role TEXT NOT NULL DEFAULT 'admin' CHECK (role IN ('superadmin', 'admin')),
  is_active BOOLEAN NOT NULL DEFAULT TRUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 2. Tabel Konfigurasi Live Bot (Singleton row: id = 1)
CREATE TABLE IF NOT EXISTS public.bot_settings (
  id INTEGER PRIMARY KEY DEFAULT 1 CHECK (id = 1),
  maintenance_mode BOOLEAN NOT NULL DEFAULT FALSE,
  ai_meme_enabled BOOLEAN NOT NULL DEFAULT TRUE,
  daily_ai_limit_per_user INTEGER NOT NULL DEFAULT 10 CHECK (daily_ai_limit_per_user >= 0),
  daily_web_ai_limit_per_ip INTEGER NOT NULL DEFAULT 5 CHECK (daily_web_ai_limit_per_ip >= 0),
  maintenance_message TEXT NOT NULL DEFAULT 'Bot sedang dalam pemeliharaan sementara. Silakan coba lagi beberapa saat lagi.',
  updated_by UUID REFERENCES public.admin_profiles(id) ON DELETE SET NULL,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Pastikan baris default konfigurasi selalu ada
INSERT INTO public.bot_settings (id)
VALUES (1)
ON CONFLICT (id) DO NOTHING;

-- 3. Tambah Kolom Moderasi (Blokir Spam) pada Tabel wa_users
ALTER TABLE public.wa_users
  ADD COLUMN IF NOT EXISTS is_blocked BOOLEAN NOT NULL DEFAULT FALSE;

ALTER TABLE public.wa_users
  ADD COLUMN IF NOT EXISTS blocked_reason TEXT;

ALTER TABLE public.wa_users
  ADD COLUMN IF NOT EXISTS blocked_at TIMESTAMPTZ;

CREATE INDEX IF NOT EXISTS idx_wa_users_is_blocked ON public.wa_users (is_blocked);

-- 4. Tabel Rate Limiting Harian (Bebas Redis, persisten di serverless Vercel)
CREATE TABLE IF NOT EXISTS public.rate_limits (
  rate_key TEXT NOT NULL, -- contoh: 'wa:62812xxx' atau 'web:<sha256_ip>'
  window_date DATE NOT NULL, -- Tanggal zona Asia/Jakarta (WIB)
  ai_count INTEGER NOT NULL DEFAULT 0,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  PRIMARY KEY (rate_key, window_date)
);

-- Fungsi atomik untuk cek & tambah kuota AI harian (anti race-condition)
CREATE OR REPLACE FUNCTION public.consume_ai_quota(
  p_rate_key TEXT,
  p_daily_limit INTEGER
)
RETURNS TABLE (allowed BOOLEAN, current_count INTEGER, remaining INTEGER) AS $$
DECLARE
  v_today DATE := (NOW() AT TIME ZONE 'Asia/Jakarta')::DATE;
  v_count INTEGER;
BEGIN
  IF p_daily_limit <= 0 THEN
    RETURN QUERY SELECT FALSE, 0, 0;
    RETURN;
  END IF;

  INSERT INTO public.rate_limits (rate_key, window_date, ai_count, updated_at)
  VALUES (p_rate_key, v_today, 0, NOW())
  ON CONFLICT (rate_key, window_date) DO NOTHING;

  UPDATE public.rate_limits
  SET
    ai_count = ai_count + 1,
    updated_at = NOW()
  WHERE rate_key = p_rate_key
    AND window_date = v_today
    AND ai_count < p_daily_limit
  RETURNING ai_count INTO v_count;

  IF FOUND THEN
    RETURN QUERY SELECT TRUE, v_count, GREATEST(0, p_daily_limit - v_count);
  ELSE
    SELECT rl.ai_count INTO v_count
    FROM public.rate_limits rl
    WHERE rl.rate_key = p_rate_key AND rl.window_date = v_today;

    RETURN QUERY SELECT FALSE, COALESCE(v_count, p_daily_limit), 0;
  END IF;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 5. Tabel Audit Trail Aktivitas Admin
CREATE TABLE IF NOT EXISTS public.admin_audit_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  admin_id UUID REFERENCES public.admin_profiles(id) ON DELETE SET NULL,
  admin_email TEXT NOT NULL,
  action TEXT NOT NULL,
  target TEXT,
  details JSONB,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_admin_audit_logs_created_at
  ON public.admin_audit_logs (created_at DESC);

-- 6. Aktifkan Row Level Security (Semua diakses lewat backend service_role)
ALTER TABLE public.admin_profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.bot_settings ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.rate_limits ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.admin_audit_logs ENABLE ROW LEVEL SECURITY;

-- ============================================================================
-- LANGKAH MANUAL SETELAH MIGRASI:
-- 1. Buat akun admin di Supabase Dashboard -> Authentication -> Users -> Add user
--    (aktifkan "Auto Confirm User").
-- 2. Jalankan query di bawah dengan mengganti email admin kamu:
--
-- INSERT INTO public.admin_profiles (id, email, full_name, role)
-- SELECT id, email, 'Super Admin', 'superadmin'
-- FROM auth.users
-- WHERE email = 'admin@kampus.ac.id'
-- ON CONFLICT (id) DO UPDATE SET role = 'superadmin', is_active = TRUE;
-- ============================================================================