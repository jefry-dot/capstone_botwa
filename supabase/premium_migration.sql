-- ============================================================================
-- Migration v4.0: Skema Freemium & User Premium Portal (WhatsApp-First Bot)
-- Jalankan di Supabase SQL Editor setelah schema.sql dan rbac_migration.sql
-- ============================================================================

-- 1. Tabel Profil User Web (Terpisah tegas dari admin_profiles)
CREATE TABLE IF NOT EXISTS public.user_profiles (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  email TEXT NOT NULL UNIQUE,
  full_name TEXT NOT NULL DEFAULT 'Pengguna',
  plan TEXT NOT NULL DEFAULT 'free' CHECK (plan IN ('free', 'pro')),
  pro_expires_at TIMESTAMPTZ,
  custom_pack_name TEXT,
  custom_pack_author TEXT,
  linked_wa_id TEXT UNIQUE,
  link_code TEXT,
  link_code_expires_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_user_profiles_linked_wa_id ON public.user_profiles (linked_wa_id);
CREATE INDEX IF NOT EXISTS idx_user_profiles_link_code ON public.user_profiles (link_code);
CREATE INDEX IF NOT EXISTS idx_user_profiles_plan ON public.user_profiles (plan);

-- 2. Tabel Riwayat Order / Simulasi Upgrade Pro
CREATE TABLE IF NOT EXISTS public.subscription_orders (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES public.user_profiles(id) ON DELETE CASCADE,
  plan TEXT NOT NULL DEFAULT 'pro',
  amount_idr INTEGER NOT NULL DEFAULT 15000,
  payment_method TEXT NOT NULL CHECK (payment_method IN ('qris_demo', 'voucher', 'admin_grant')),
  voucher_code TEXT,
  status TEXT NOT NULL DEFAULT 'paid',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_subscription_orders_user_id ON public.subscription_orders (user_id, created_at DESC);

-- 3. Tambah Kolom Pendukung pada Tabel Existing
ALTER TABLE public.sticker_logs
  ADD COLUMN IF NOT EXISTS user_id UUID REFERENCES public.user_profiles(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_sticker_logs_user_id ON public.sticker_logs (user_id, created_at DESC);

ALTER TABLE public.bot_settings
  ADD COLUMN IF NOT EXISTS daily_pro_ai_limit INTEGER NOT NULL DEFAULT 50 CHECK (daily_pro_ai_limit >= 0);

-- 4. Aktifkan Row Level Security (Semua akses lewat backend API route dengan verifikasi sesi)
ALTER TABLE public.user_profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.subscription_orders ENABLE ROW LEVEL SECURITY;
