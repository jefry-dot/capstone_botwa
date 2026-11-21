-- 1. Tabel User WhatsApp
CREATE TABLE IF NOT EXISTS public.wa_users (
  wa_id TEXT PRIMARY KEY,
  profile_name TEXT,
  total_stickers INTEGER NOT NULL DEFAULT 0,
  first_seen_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  last_active_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 2. Tabel Log Pembuatan Stiker (WA & Web)
CREATE TABLE IF NOT EXISTS public.sticker_logs (
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

CREATE INDEX IF NOT EXISTS idx_sticker_logs_created_at ON public.sticker_logs (created_at DESC);
CREATE INDEX IF NOT EXISTS idx_sticker_logs_source ON public.sticker_logs (source);

-- 3. Trigger Auto-Increment total stiker user WA
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

DROP TRIGGER IF EXISTS trg_increment_sticker_count ON public.sticker_logs;
CREATE TRIGGER trg_increment_sticker_count
AFTER INSERT ON public.sticker_logs
FOR EACH ROW
EXECUTE FUNCTION public.increment_user_sticker_count();

-- 4. Row Level Security (tabel mentah diproteksi, diakses via service_role)
ALTER TABLE public.wa_users ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.sticker_logs ENABLE ROW LEVEL SECURITY;

-- 5. View Aman untuk Dashboard Publik (tanpa ekspos nomor WA)
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