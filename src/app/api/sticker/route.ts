import { NextRequest, NextResponse } from "next/server";
import { getSupabaseAdmin } from "@/lib/supabase";
import { generateAiMemeCaption, type AiMemeMode } from "@/lib/gemini";
import {
  processImageToSticker,
  createQuoteBubbleSticker,
  createBratSticker,
  createBreakingNewsSticker,
  type StickerResult,
} from "@/lib/sticker-processor";
import type { StickerCommandType, StickerLogInsert } from "@/types/database";

export const runtime = "nodejs";

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

  try {
    const formData = await request.formData();
    const rawCommand = String(formData.get("commandType") ?? "standard").trim();

    if (!VALID_COMMANDS.has(rawCommand as StickerCommandType)) {
      return NextResponse.json(
        { error: `Mode stiker tidak valid: ${rawCommand}` },
        { status: 400 }
      );
    }

    commandType = rawCommand as StickerCommandType;

    let imageBuffer: Buffer | null = null;

    // Validasi file gambar jika mode membutuhkan foto
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

    let result: StickerResult;
    let aiGeneratedCaptionHeader: string | null = null;

    switch (commandType) {
      case "quote_chat": {
        const quoteName = String(formData.get("quoteName") ?? "Mahasiswa").trim();
        const quoteText = String(formData.get("quoteText") ?? "").trim();
        if (!quoteText) {
          return NextResponse.json(
            { error: "Isi pesan Quote Chat tidak boleh kosong." },
            { status: 400 }
          );
        }
        captionLog = `${quoteName}: ${quoteText}`.slice(0, 200);
        result = await createQuoteBubbleSticker({
          name: quoteName || "Mahasiswa",
          text: quoteText,
        });
        break;
      }

      case "brat_text": {
        const bratText = String(formData.get("bratText") ?? "").trim();
        if (!bratText) {
          return NextResponse.json(
            { error: "Teks Brat tidak boleh kosong." },
            { status: 400 }
          );
        }
        captionLog = bratText.slice(0, 200);
        result = await createBratSticker({ text: bratText });
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
        });
        break;
      }

      case "breaking_news": {
        const headline =
          String(formData.get("newsHeadline") ?? "").trim() ||
          "BERITA TERKINI HARI INI";
        captionLog = headline.slice(0, 200);
        result = await createBreakingNewsSticker(imageBuffer!, { headline });
        break;
      }

      case "meme_text": {
        const topText = String(formData.get("topText") ?? "").trim();
        const bottomText = String(formData.get("bottomText") ?? "").trim();
        captionLog = `${topText} | ${bottomText}`.slice(0, 200);
        result = await processImageToSticker(imageBuffer!, {
          topText,
          bottomText,
          mode: "contain",
        });
        break;
      }

      case "crop": {
        result = await processImageToSticker(imageBuffer!, { mode: "cover" });
        break;
      }

      case "standard":
      default: {
        result = await processImageToSticker(imageBuffer!, { mode: "contain" });
        break;
      }
    }

    const totalProcessMs =
      commandType === "ai_meme"
        ? Date.now() - totalStart
        : result.processingTimeMs;

    await logWebSticker({
      wa_id: null,
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

    return new NextResponse(new Uint8Array(result.buffer), {
      status: 200,
      headers,
    });
  } catch (err) {
    const errMsg = err instanceof Error ? err.message : "Terjadi kesalahan server.";
    console.error(`[API /api/sticker - ${commandType}] Error:`, errMsg);

    await logWebSticker({
      wa_id: null,
      source: "web",
      command_type: commandType,
      caption_text: captionLog,
      status: "failed",
      error_message: errMsg.slice(0, 500),
      processing_time_ms: Date.now() - totalStart,
    });

    return NextResponse.json({ error: errMsg }, { status: 500 });
  }
}