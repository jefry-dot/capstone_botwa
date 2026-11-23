import { NextRequest, NextResponse } from "next/server";
import { getSupabaseAdmin } from "@/lib/supabase";
import { generateAiMemeCaption, type AiMemeMode } from "@/lib/gemini";
import {
  getBotSettings,
  getWebClientRateKey,
  consumeAiQuota,
  refundAiQuota,
} from "@/lib/bot-guard";
import { getCurrentUserProfile } from "@/lib/user-auth";
import {
  processImageToSticker,
  createQuoteBubbleSticker,
  createBratSticker,
  createBreakingNewsSticker,
  type StickerExifOptions,
  type StickerResult,
} from "@/lib/sticker-processor";
import type { StickerCommandType, StickerLogInsert } from "@/types/database";

export const runtime = "nodejs";
export const maxDuration = 60;

const MAX_UPLOAD_BYTES = 5 * 1024 * 1024; // 5 MB

const VALID_COMMANDS = new Set<StickerCommandType>([
  "standard",
  "crop",
  "meme_text",
  "ai_meme",
  "quote_chat",
  "brat_text",
  "breaking_news",
]);

const TEXT_ONLY_COMMANDS = new Set<StickerCommandType>([
  "quote_chat",
  "brat_text",
]);

async function logWebSticker(log: StickerLogInsert) {
  try {
    const supabase = getSupabaseAdmin();
    const { error } = await supabase.from("sticker_logs").insert(log);
    if (error) console.error("[Supabase /api/sticker] Log error:", error);
  } catch (err) {
    console.error("[Supabase /api/sticker] Unexpected error:", err);
  }
}

export async function POST(request: NextRequest) {
  const totalStart = Date.now();
  let commandType: StickerCommandType = "standard";
  let captionLog: string | null = null;
  let currentUserId: string | null = null;
  let consumedRateKey: string | null = null;

  try {
    // 1. Cek konfigurasi live bot (Maintenance Mode) & sesi user web (opsional)
    const [settings, currentUser] = await Promise.all([
      getBotSettings(),
      getCurrentUserProfile(),
    ]);
    currentUserId = currentUser?.id ?? null;

    if (settings.maintenance_mode) {
      return NextResponse.json(
        {
          error:
            settings.maintenance_message ||
            "Layanan sedang dalam pemeliharaan sementara.",
        },
        { status: 503 }
      );
    }

    const formData = await request.formData();
    const rawCommand = String(formData.get("commandType") ?? "standard").trim();

    if (!VALID_COMMANDS.has(rawCommand as StickerCommandType)) {
      return NextResponse.json(
        { error: `Mode stiker tidak valid: ${rawCommand}` },
        { status: 400 }
      );
    }

    commandType = rawCommand as StickerCommandType;

    // 2. Validasi seluruh input (file & teks wajib) SEBELUM memotong kuota AI
    let imageBuffer: Buffer | null = null;
    if (!TEXT_ONLY_COMMANDS.has(commandType)) {
      const file = formData.get("file");
      if (!(file instanceof File) || file.size === 0) {
        return NextResponse.json(
          { error: "File gambar wajib diunggah untuk mode ini." },
          { status: 400 }
        );
      }

      if (!file.type.startsWith("image/")) {
        return NextResponse.json(
          { error: "Format file harus berupa gambar (JPG, PNG, WebP)." },
          { status: 400 }
        );
      }

      if (file.size > MAX_UPLOAD_BYTES) {
        return NextResponse.json(
          { error: "Ukuran gambar maksimal 5 MB." },
          { status: 400 }
        );
      }

      imageBuffer = Buffer.from(await file.arrayBuffer());
    }

    const quoteName = String(formData.get("quoteName") ?? "Mahasiswa").trim();
    const quoteText = String(formData.get("quoteText") ?? "").trim();
    const bratText = String(formData.get("bratText") ?? "").trim();
    const topText = String(formData.get("topText") ?? "").trim();
    const bottomText = String(formData.get("bottomText") ?? "").trim();

    if (commandType === "quote_chat" && !quoteText) {
      return NextResponse.json(
        { error: "Isi pesan Quote Chat tidak boleh kosong." },
        { status: 400 }
      );
    }
    if (commandType === "brat_text" && !bratText) {
      return NextResponse.json(
        { error: "Teks Brat tidak boleh kosong." },
        { status: 400 }
      );
    }
    if (commandType === "meme_text" && !topText && !bottomText) {
      return NextResponse.json(
        {
          error:
            "Minimal salah satu dari Teks Atas atau Teks Bawah wajib diisi untuk mode Meme Klasik.",
        },
        { status: 400 }
      );
    }

    // 3. Guard khusus fitur AI Vision (toggle admin & kuota harian sesuai akun/IP)
    let aiRemainingHeader: string | null = null;
    if (commandType === "ai_meme") {
      if (!settings.ai_meme_enabled) {
        return NextResponse.json(
          {
            error:
              "Fitur AI Meme / Roast sedang dinonaktifkan sementara oleh Admin. Silakan gunakan mode lain.",
          },
          { status: 503 }
        );
      }

      const rateKey = currentUser
        ? currentUser.linkedWaId
          ? `wa:${currentUser.linkedWaId}`
          : `user:${currentUser.id}`
        : getWebClientRateKey(request);

      const dailyLimit = currentUser
        ? currentUser.isProActive
          ? settings.daily_pro_ai_limit
          : settings.daily_ai_limit_per_user
        : settings.daily_web_ai_limit_per_ip;

      const quota = await consumeAiQuota(rateKey, dailyLimit);

      if (!quota.allowed) {
        return NextResponse.json(
          {
            error: `Kuota AI Vision harian kamu sudah habis (maksimal ${quota.limit}x/hari). Coba lagi besok atau gunakan mode Foto, Quote Chat, Brat, atau Breaking News.`,
          },
          { status: 429 }
        );
      }

      consumedRateKey = rateKey;
      aiRemainingHeader = String(quota.remaining);
    }

    const exif: StickerExifOptions | undefined = currentUser?.isProActive
      ? {
          packName: currentUser.customPackName,
          packPublisher: currentUser.customPackAuthor,
        }
      : undefined;

    let result: StickerResult;
    let aiGeneratedCaptionHeader: string | null = null;

    switch (commandType) {
      case "quote_chat": {
        captionLog = `${quoteName}: ${quoteText}`.slice(0, 200);
        result = await createQuoteBubbleSticker({
          name: quoteName || "Mahasiswa",
          text: quoteText,
          exif,
        });
        break;
      }

      case "brat_text": {
        captionLog = bratText.slice(0, 200);
        result = await createBratSticker({ text: bratText, exif });
        break;
      }

      case "ai_meme": {
        const aiStyleRaw = String(formData.get("aiStyle") ?? "aimeme").trim();
        const aiMode: AiMemeMode = aiStyleRaw === "roast" ? "roast" : "aimeme";

        const aiCaption = await generateAiMemeCaption(imageBuffer!, aiMode);
        captionLog = `[${aiMode}] ${aiCaption.topText} | ${aiCaption.bottomText}`.slice(
          0,
          200
        );
        aiGeneratedCaptionHeader = encodeURIComponent(
          `${aiCaption.topText} | ${aiCaption.bottomText}`
        );

        result = await processImageToSticker(imageBuffer!, {
          topText: aiCaption.topText,
          bottomText: aiCaption.bottomText,
          mode: "contain",
          exif,
        });
        break;
      }

      case "breaking_news": {
        const headline =
          String(formData.get("newsHeadline") ?? "").trim() ||
          "BERITA TERKINI HARI INI";
        captionLog = headline.slice(0, 200);
        result = await createBreakingNewsSticker(imageBuffer!, {
          headline,
          exif,
        });
        break;
      }

      case "meme_text": {
        captionLog = `${topText} | ${bottomText}`.slice(0, 200);
        result = await processImageToSticker(imageBuffer!, {
          topText,
          bottomText,
          mode: "contain",
          exif,
        });
        break;
      }

      case "crop": {
        result = await processImageToSticker(imageBuffer!, {
          mode: "cover",
          exif,
        });
        break;
      }

      case "standard":
      default: {
        result = await processImageToSticker(imageBuffer!, {
          mode: "contain",
          exif,
        });
        break;
      }
    }

    const totalProcessMs =
      commandType === "ai_meme"
        ? Date.now() - totalStart
        : result.processingTimeMs;

    await logWebSticker({
      wa_id: null,
      user_id: currentUserId,
      source: "web",
      command_type: commandType,
      caption_text: captionLog,
      status: "success",
      processing_time_ms: totalProcessMs,
      file_size_kb: result.sizeKb,
    });

    const headers: Record<string, string> = {
      "Content-Type": "image/webp",
      "Content-Disposition": `inline; filename="sticker-${commandType}.webp"`,
      "Cache-Control": "no-store",
      "X-Processing-Time-Ms": String(totalProcessMs),
      "X-File-Size-Kb": String(result.sizeKb),
      "X-Command-Type": commandType,
    };

    if (aiGeneratedCaptionHeader) {
      headers["X-Ai-Caption"] = aiGeneratedCaptionHeader;
    }
    if (aiRemainingHeader !== null) {
      headers["X-Ai-Quota-Remaining"] = aiRemainingHeader;
    }

    return new NextResponse(new Uint8Array(result.buffer), {
      status: 200,
      headers,
    });
  } catch (err) {
    const errMsg =
      err instanceof Error ? err.message : "Terjadi kesalahan server.";
    console.error(`[API /api/sticker - ${commandType}] Error:`, errMsg);

    if (consumedRateKey) {
      await refundAiQuota(consumedRateKey);
    }

    await logWebSticker({
      wa_id: null,
      user_id: currentUserId,
      source: "web",
      command_type: commandType,
      caption_text: captionLog,
      status: "failed",
      error_message: errMsg.slice(0, 500),
      processing_time_ms: Date.now() - totalStart,
    });

    return NextResponse.json(
      {
        error:
          commandType === "ai_meme"
            ? "Gagal memproses stiker AI Vision. Silakan coba lagi beberapa saat lagi."
            : "Gagal memproses gambar menjadi stiker. Pastikan format gambar valid dan coba lagi.",
      },
      { status: 500 }
    );
  }
}