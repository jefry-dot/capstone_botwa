import { NextRequest, NextResponse, after } from "next/server";
import { verifyMetaSignature } from "@/lib/signature";
import { getSupabaseAdmin } from "@/lib/supabase";
import { generateAiMemeCaption, type AiMemeMode } from "@/lib/gemini";
import {
  processImageToSticker,
  createQuoteBubbleSticker,
  createBratSticker,
  createBreakingNewsSticker,
  type StickerResult,
} from "@/lib/sticker-processor";
import {
  downloadWhatsAppMedia,
  uploadStickerMedia,
  sendStickerMessage,
  sendTextMessage,
} from "@/lib/whatsapp";
import type {
  WhatsAppWebhookPayload,
  WhatsAppIncomingMessage,
} from "@/types/whatsapp";
import type { StickerCommandType, StickerLogInsert } from "@/types/database";

export const runtime = "nodejs";
export const maxDuration = 60;

// In-Memory TTL Cache (5 menit) untuk menahan retry instan webhook Meta
const DEDUP_TTL_MS = 5 * 60 * 1000;
const recentMessageIds = new Map<string, number>();

function isDuplicateInMemory(messageId: string): boolean {
  const now = Date.now();
  for (const [id, timestamp] of recentMessageIds.entries()) {
    if (now - timestamp > DEDUP_TTL_MS) {
      recentMessageIds.delete(id);
    }
  }

  if (recentMessageIds.has(messageId)) {
    return true;
  }

  recentMessageIds.set(messageId, now);
  return false;
}

async function isDuplicateInSupabase(messageId: string): Promise<boolean> {
  try {
    const supabase = getSupabaseAdmin();
    const { data, error } = await supabase
      .from("sticker_logs")
      .select("id")
      .eq("wa_message_id", messageId)
      .limit(1);

    if (error) {
      return false;
    }

    return Boolean(data && data.length > 0);
  } catch {
    return false;
  }
}

const HELP_MESSAGE = [
  "🎨 *WA AI Sticker Studio — Daftar Perintah*",
  "",
  "📸 *Kirim Foto + Caption:*",
  "• *(tanpa caption)* atau `/stiker` → Stiker transparan",
  "• `/crop` → Stiker penuh 1:1 (kotak)",
  "• `/stiker Atas | Bawah` → Meme klasik",
  "• `/aimeme` → AI otomatis bikin caption meme dari foto",
  "• `/roast` → AI otomatis roasting foto secara lucu",
  "• `/news Headline Berita` → Frame TV Breaking News",
  "",
  "💬 *Kirim Teks Saja (Tanpa Foto):*",
  "• `/qc Isi pesan chat` → Stiker bubble chat WA",
  "• `/brat teks kamu` → Stiker tipografi Brat hijau",
  "",
  "Ketik `/help` kapan saja untuk melihat panduan ini lagi.",
].join("\n");

// ============================================================================
// GET: Verifikasi Webhook Meta WhatsApp Cloud API
// ============================================================================
export async function GET(request: NextRequest) {
  const searchParams = request.nextUrl.searchParams;
  const mode = searchParams.get("hub.mode");
  const token = searchParams.get("hub.verify_token");
  const challenge = searchParams.get("hub.challenge");

  const expectedToken = process.env.WHATSAPP_VERIFY_TOKEN;

  if (mode === "subscribe" && token && token === expectedToken && challenge) {
    return new NextResponse(challenge, {
      status: 200,
      headers: { "Content-Type": "text/plain" },
    });
  }

  return NextResponse.json(
    { error: "Webhook verification failed." },
    { status: 403 }
  );
}

// ============================================================================
// POST: Terima Pesan dari Meta (Langsung 200 OK, Proses via after())
// ============================================================================
export async function POST(request: NextRequest) {
  const rawBody = await request.text();
  const signature = request.headers.get("x-hub-signature-256");

  if (!verifyMetaSignature(rawBody, signature)) {
    return NextResponse.json({ error: "Invalid signature." }, { status: 401 });
  }

  let payload: WhatsAppWebhookPayload;
  try {
    payload = JSON.parse(rawBody) as WhatsAppWebhookPayload;
  } catch {
    return NextResponse.json({ error: "Invalid JSON." }, { status: 400 });
  }

  if (payload.object !== "whatsapp_business_account") {
    return NextResponse.json({ status: "ignored" }, { status: 200 });
  }

  // Kumpulkan semua pesan masuk (abaikan event statuses seperti sent/delivered/read)
  const incomingTasks: Array<{
    message: WhatsAppIncomingMessage;
    profileName: string;
  }> = [];

  for (const entry of payload.entry ?? []) {
    for (const change of entry.changes ?? []) {
      const value = change.value;
      if (!value?.messages?.length) continue;

      const contactsMap = new Map<string, string>();
      for (const contact of value.contacts ?? []) {
        contactsMap.set(contact.wa_id, contact.profile?.name ?? "User WA");
      }

      for (const message of value.messages) {
        if (!message.id || isDuplicateInMemory(message.id)) {
          console.info(`[Webhook Dedup] Skipping duplicate message.id in memory: ${message.id}`);
          continue;
        }

        incomingTasks.push({
          message,
          profileName: contactsMap.get(message.from) ?? "User WA",
        });
      }
    }
  }

  if (incomingTasks.length > 0) {
    after(async () => {
      await Promise.allSettled(
        incomingTasks.map(({ message, profileName }) =>
          processWhatsAppMessage(message, profileName)
        )
      );
    });
  }

  return NextResponse.json({ status: "ok" }, { status: 200 });
}

// ============================================================================
// Helper Logging & Upsert User Supabase
// ============================================================================
async function upsertWaUser(waId: string, profileName: string) {
  try {
    const supabase = getSupabaseAdmin();
    await supabase.from("wa_users").upsert(
      {
        wa_id: waId,
        profile_name: profileName,
        last_active_at: new Date().toISOString(),
      },
      { onConflict: "wa_id" }
    );
  } catch (err) {
    console.error("[Supabase] Failed to upsert wa_user:", err);
  }
}

async function insertStickerLog(log: StickerLogInsert) {
  try {
    const supabase = getSupabaseAdmin();
    const { error } = await supabase.from("sticker_logs").insert(log);
    if (error) console.error("[Supabase] Insert sticker_log error:", error);
  } catch (err) {
    console.error("[Supabase] Unexpected log error:", err);
  }
}

// ============================================================================
// Router Utama Pesan Masuk (Teks & Gambar)
// ============================================================================
async function processWhatsAppMessage(
  message: WhatsAppIncomingMessage,
  profileName: string
) {
  const waId = message.from;
  const messageId = message.id;

  // Cek layer deduplikasi persisten di Supabase sebelum memproses gambar/AI
  if (await isDuplicateInSupabase(messageId)) {
    console.info(`[Webhook Dedup] Skipping duplicate message.id in Supabase: ${messageId}`);
    return;
  }

  if (message.type === "text") {
    await handleTextMessage(waId, profileName, messageId, message.text?.body ?? "");
    return;
  }

  if (message.type === "image" && message.image?.id) {
    await handleImageMessage(
      waId,
      profileName,
      messageId,
      message.image.id,
      message.image.caption ?? ""
    );
    return;
  }

  // Abaikan stiker/audio/video yang tidak didukung dengan pesan singkat
  if (message.type !== "sticker") {
    await sendTextMessage(
      waId,
      "Format belum didukung bro 😅 Kirim *foto* (bisa ditambah caption `/aimeme`, `/roast`, `/news`, `/crop`) atau ketik `/qc <teks>` / `/brat <teks>`. Ketik `/help` untuk panduan."
    );
  }
}

// ============================================================================
// A. Handler Pesan Teks (/qc, /brat, /help)
// ============================================================================
async function handleTextMessage(
  waId: string,
  profileName: string,
  messageId: string,
  rawText: string
) {
  const trimmed = rawText.trim();
  const lower = trimmed.toLowerCase();

  // Mode 4: Fake Chat Quote Bubble (/qc <teks>)
  if (lower === "/qc" || lower.startsWith("/qc ")) {
    const quoteText = trimmed.slice(3).trim();
    if (!quoteText) {
      await sendTextMessage(
        waId,
        "Format salah. Contoh penggunaan:\n`/qc Besok bimbingan jam 8 jangan telat!`"
      );
      return;
    }

    await upsertWaUser(waId, profileName);
    const startTime = Date.now();

    try {
      const result = await createQuoteBubbleSticker({
        name: profileName,
        text: quoteText,
      });

      const mediaId = await uploadStickerMedia(result.buffer);
      await sendStickerMessage(waId, mediaId);

      await insertStickerLog({
        wa_id: waId,
        wa_message_id: messageId,
        source: "whatsapp",
        command_type: "quote_chat",
        caption_text: quoteText.slice(0, 200),
        status: "success",
        processing_time_ms: result.processingTimeMs,
        file_size_kb: result.sizeKb,
      });
    } catch (err) {
      const errMsg = err instanceof Error ? err.message : "Unknown error";
      console.error("[Webhook /qc] Error:", errMsg);

      await insertStickerLog({
        wa_id: waId,
        wa_message_id: messageId,
        source: "whatsapp",
        command_type: "quote_chat",
        caption_text: quoteText.slice(0, 200),
        status: "failed",
        error_message: errMsg.slice(0, 500),
        processing_time_ms: Date.now() - startTime,
      });

      await sendTextMessage(waId, "Gagal bikin stiker /qc nih, coba lagi ya.");
    }
    return;
  }

  // Mode 5A: Brat Typography (/brat <teks>)
  if (lower === "/brat" || lower.startsWith("/brat ")) {
    const bratText = trimmed.slice(5).trim();
    if (!bratText) {
      await sendTextMessage(
        waId,
        "Format salah. Contoh penggunaan:\n`/brat lagi pusing revisi bab 4`"
      );
      return;
    }

    await upsertWaUser(waId, profileName);
    const startTime = Date.now();

    try {
      const result = await createBratSticker({ text: bratText });
      const mediaId = await uploadStickerMedia(result.buffer);
      await sendStickerMessage(waId, mediaId);

      await insertStickerLog({
        wa_id: waId,
        wa_message_id: messageId,
        source: "whatsapp",
        command_type: "brat_text",
        caption_text: bratText.slice(0, 200),
        status: "success",
        processing_time_ms: result.processingTimeMs,
        file_size_kb: result.sizeKb,
      });
    } catch (err) {
      const errMsg = err instanceof Error ? err.message : "Unknown error";
      console.error("[Webhook /brat] Error:", errMsg);

      await insertStickerLog({
        wa_id: waId,
        wa_message_id: messageId,
        source: "whatsapp",
        command_type: "brat_text",
        caption_text: bratText.slice(0, 200),
        status: "failed",
        error_message: errMsg.slice(0, 500),
        processing_time_ms: Date.now() - startTime,
      });

      await sendTextMessage(waId, "Gagal bikin stiker /brat nih, coba lagi ya.");
    }
    return;
  }

  // Default (/help, menu, sapaan, dll.)
  await sendTextMessage(waId, HELP_MESSAGE);
}

// ============================================================================
// B. Handler Pesan Gambar (/aimeme, /roast, /news, /crop, /stiker)
// ============================================================================
async function handleImageMessage(
  waId: string,
  profileName: string,
  messageId: string,
  incomingMediaId: string,
  rawCaption: string
) {
  await upsertWaUser(waId, profileName);

  const caption = rawCaption.trim();
  const lower = caption.toLowerCase();

  let commandType: StickerCommandType = "standard";
  let loggedCaption: string | null = caption ? caption.slice(0, 200) : null;
  const totalStart = Date.now();

  try {
    const imageBuffer = await downloadWhatsAppMedia(incomingMediaId);
    let result: StickerResult;

    if (
      lower === "/aimeme" ||
      lower.startsWith("/aimeme ") ||
      lower === "/roast" ||
      lower.startsWith("/roast ")
    ) {
      // Mode 3: AI Vision Auto-Meme & Roast
      commandType = "ai_meme";
      const aiMode: AiMemeMode = lower.startsWith("/roast")
        ? "roast"
        : "aimeme";

      const aiCaption = await generateAiMemeCaption(imageBuffer, aiMode);
      loggedCaption = `[${aiMode}] ${aiCaption.topText} | ${aiCaption.bottomText}`.slice(
        0,
        200
      );

      result = await processImageToSticker(imageBuffer, {
        topText: aiCaption.topText,
        bottomText: aiCaption.bottomText,
        mode: "contain",
      });
    } else if (lower === "/news" || lower.startsWith("/news ")) {
      // Mode 5B: Live Breaking News Frame
      commandType = "breaking_news";
      const headline =
        caption.slice(5).trim() || "BERITA TERKINI HARI INI";
      loggedCaption = headline.slice(0, 200);

      result = await createBreakingNewsSticker(imageBuffer, { headline });
    } else if (lower === "/crop" || lower.startsWith("/crop ")) {
      // Mode 1B: Smart Crop 1:1
      commandType = "crop";
      result = await processImageToSticker(imageBuffer, { mode: "cover" });
    } else if (caption.includes("|")) {
      // Mode 2: Classic Meme Generator (/stiker Atas | Bawah)
      commandType = "meme_text";
      const cleaned = caption.replace(/^\/(stiker|meme)\s*/i, "");
      const [topText = "", bottomText = ""] = cleaned
        .split("|")
        .map((s) => s.trim());

      result = await processImageToSticker(imageBuffer, {
        topText,
        bottomText,
        mode: "contain",
      });
    } else {
      // Mode 1A: Standard Sticker
      commandType = "standard";
      result = await processImageToSticker(imageBuffer, { mode: "contain" });
    }

    const totalProcessMs =
      commandType === "ai_meme"
        ? Date.now() - totalStart
        : result.processingTimeMs;

    const uploadedMediaId = await uploadStickerMedia(result.buffer);
    await sendStickerMessage(waId, uploadedMediaId);

    await insertStickerLog({
      wa_id: waId,
      wa_message_id: messageId,
      source: "whatsapp",
      command_type: commandType,
      caption_text: loggedCaption,
      status: "success",
      processing_time_ms: totalProcessMs,
      file_size_kb: result.sizeKb,
    });
  } catch (err) {
    const errMsg = err instanceof Error ? err.message : "Unknown error";
    console.error(`[Webhook Image - ${commandType}] Error:`, errMsg);

    await insertStickerLog({
      wa_id: waId,
      wa_message_id: messageId,
      source: "whatsapp",
      command_type: commandType,
      caption_text: loggedCaption,
      status: "failed",
      error_message: errMsg.slice(0, 500),
      processing_time_ms: Date.now() - totalStart,
    });

    await sendTextMessage(
      waId,
      "Waduh, gagal memproses fotomu jadi stiker 😅 Pastikan gambarnya jelas dan coba kirim ulang ya."
    );
  }
}
