export type StickerSource = "whatsapp" | "web";

export type StickerCommandType =
  | "standard"
  | "crop"
  | "meme_text"
  | "ai_meme"
  | "quote_chat"
  | "brat_text"
  | "breaking_news";

export type StickerStatus = "success" | "failed";

export interface WaUserRow {
  wa_id: string;
  profile_name: string | null;
  total_stickers: number;
  first_seen_at: string;
  last_active_at: string;
}

export interface StickerLogInsert {
  wa_id?: string | null;
  source: StickerSource;
  command_type: StickerCommandType;
  caption_text?: string | null;
  status: StickerStatus;
  error_message?: string | null;
  processing_time_ms?: number | null;
  file_size_kb?: number | null;
}

export interface DailyStatsRow {
  log_date: string;
  source: StickerSource;
  success_count: number;
  failed_count: number;
  avg_process_ms: number | null;
  avg_size_kb: number | null;
}

export interface FeatureStatsRow {
  command_type: StickerCommandType;
  total_used: number;
  avg_process_ms: number | null;
}

export interface RecentActivityRow {
  id: string;
  source: StickerSource;
  display_name: string;
  command_type: StickerCommandType;
  status: StickerStatus;
  processing_time_ms: number | null;
  file_size_kb: number | null;
  created_at: string;
}