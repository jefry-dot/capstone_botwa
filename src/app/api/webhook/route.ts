import { NextRequest, NextResponse, after } from "next/server";
import { verifyMetaSignature } from "@/lib/signature";
import { getSupabaseAdmin } from "@/lib/supabase";
import { generateAiMemeCaption, type AiMemeMode } from "@/lib/gemini";
import {
  getBotSettings,
  isWaUserBlocked,
  consumeAiQuota,
  refundAiQuota,
  getTodayAiUsage,
  getLinkedUserByWaId,
  verifyAndLinkWaCode,
  type BotSettings,
  type LinkedWaMember,
} from "@/lib/bot-guard";
import {
  processImageToSticker,
  createQuoteBubbleSticker,
  createBratSticker,
  createBreakingNewsSticker,
  type StickerExifOptions,
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

const APP_URL = (
  process.env.NEXT_PUBLIC_APP_URL || "https://capstone-botwa.vercel.app"
).replace(/\/+$/, "");

const HELP_MESSAGE = [
  "🎨 *AmbaBot Studio — Daftar Perintah*",
  "",
  "📸 *Kirim Foto dengan Caption:*",
  "• `/stiker` → Stiker transparan",
  "• `/crop` → Stiker penuh 1:1 (kotak)",
  "• `/stiker Atas | Bawah` → Meme klasik",
  "• `/aimeme` → AI otomatis bikin caption meme dari foto",
  "• `/roast` → AI otomatis roasting foto secara lucu",
  "• `/news Headline Berita` → Frame TV Breaking News",
  "",
  "💬 *Kirim Teks Saja:*",
  "• `/qc Isi pesan chat` → Stiker bubble chat WA",
  "• `/brat teks kamu` → Stiker tipografi Brat hijau",
  "",
  "👑 *Akun & Paket Pro:*",
  "• `/status` → Cek paket (Free/Pro), sisa kuota AI & Pack EXIF",
  "• `/link <kode>` → Tautkan WA ke akun web untuk aktifkan Pro",
  "",
  `🌐 *Portal Akun & Upgrade Pro:* ${APP_URL}`,
].join("\n");

function resolveMemberExif(
  member: LinkedWaMember | null
): StickerExifOptions | undefined {
  if (!member?.isProActive) return undefined;
  return {
    packName: member.customPackName,
    packPublisher: member.customPackAuthor,
  };
}

function isImageCommand(lower: string): boolean {
  return (
    lower === "/stiker" ||
    lower.startsWith("/stiker ") ||
    lower === "/meme" ||
    lower.startsWith("/meme ") ||
    lower === "/crop" ||
    lower.startsWith("/crop ") ||
    lower === "/aimeme" ||
    lower.startsWith("/aimeme ") ||
    lower === "/roast" ||
    lower.startsWith("/roast ") ||
    lower === "/news" ||
    lower.startsWith("/news ")
  );
}

function isCommandText(text: string): boolean {
  const lower = text.trim().toLowerCase();
  return (
    lower === "/help" ||
    lower === "/menu" ||
    lower === "/status" ||
    lower === "/link" ||
    lower.startsWith("/link ") ||
    lower === "/qc" ||
    lower.startsWith("/qc ") ||
    lower === "/brat" ||
    lower.startsWith("/brat ") ||
    isImageCommand(lower)
  );
}

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
          console.info(
            `[Webhook Dedup] Skipping duplicate message.id in memory: ${message.id}`
          );
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
      const results = await Promise.allSettled(
        incomingTasks.map(({ message, profileName }) =>
          processWhatsAppMessage(message, profileName)
        )
      );
      for (const res of results) {
        if (res.status === "rejected") {
          console.error("[Webhook after()] Task failed:", res.reason);
        }
      }
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
// Router Utama Pesan Masuk (Strict Command-Only Mode + Pro Plan Sync)
// ============================================================================
async function processWhatsAppMessage(
  message: WhatsAppIncomingMessage,
  profileName: string
) {
  const waId = message.from;
  const messageId = message.id;

  const rawText =
    message.type === "text"
      ? (message.text?.body ?? "").trim()
      : message.type === "image"
        ? (message.image?.caption ?? "").trim()
        : "";

  // Strict command-only mode: abaikan seluruh pesan yang tidak diawali perintah valid
  if (!isCommandText(rawText)) {
    return;
  }

  const lower = rawText.toLowerCase();

  console.info(
    `[Webhook] Processing message id=${messageId} from=${waId} type=${message.type}`
  );

  // 1. Deduplikasi persisten di Supabase
  if (await isDuplicateInSupabase(messageId)) {
    console.info(
      `[Webhook Dedup] Skipping duplicate message.id in Supabase: ${messageId}`
    );
    return;
  }

  // 2. Cek apakah nomor WA pengirim diblokir oleh Admin (silent drop agar hemat kuota API)
  if (await isWaUserBlocked(waId)) {
    console.info(`[Webhook Guard] Ignoring message from blocked user: ${waId}`);
    return;
  }

  // 3. Cek Maintenance Mode global dari bot_settings
  const settings = await getBotSettings();
  if (settings.maintenance_mode) {
    await sendTextMessage(
      waId,
      `🛠️ *Mode Pemeliharaan*\n${settings.maintenance_message}`
    );
    return;
  }

  // 4. Menu / Help (diproses sebelum handler foto)
  if (lower === "/help" || lower === "/menu") {
    await sendTextMessage(waId, HELP_MESSAGE);
    return;
  }

  // 5. Perintah Tautkan Akun Web (/link <kode>)
  if (lower === "/link" || lower.startsWith("/link ")) {
    const code = rawText.slice(5).trim();
    await upsertWaUser(waId, profileName);
    const res = await verifyAndLinkWaCode(code, waId);

    if (!res.ok) {
      await sendTextMessage(waId, `❌ ${res.message}`);
      return;
    }

    const { member } = res;
    const limit = member.isProActive
      ? settings.daily_pro_ai_limit
      : settings.daily_ai_limit_per_user;
    const packLabel =
      member.isProActive && member.customPackName
        ? `${member.customPackName} (${member.customPackAuthor || "Capstone Press 2026"})`
        : "AmbaBot Studio (default)";

    await sendTextMessage(
      waId,
      [
        `✅ *Berhasil terhubung ke akun ${member.fullName}!*`,
        `• Email: ${member.email}`,
        `• Paket: *${member.isProActive ? "PRO CREATOR 👑" : "FREE PLAN"}*`,
        `• Kuota AI Harian: *${limit}x / hari*`,
        `• Pack Stiker EXIF: *${packLabel}*`,
        "",
        "Semua stiker yang kamu buat di WA sekarang otomatis tersinkron ke halaman *Akun Saya* di website!",
      ].join("\n")
    );
    return;
  }

  // 6. Perintah Cek Status Paket & Kuota (/status)
  if (lower === "/status") {
    const [member, usedToday] = await Promise.all([
      getLinkedUserByWaId(waId),
      getTodayAiUsage(`wa:${waId}`),
    ]);
    const isPro = Boolean(member?.isProActive);
    const limit = isPro
      ? settings.daily_pro_ai_limit
      : settings.daily_ai_limit_per_user;
    const remaining = Math.max(0, limit - usedToday);
    const packLabel =
      isPro && member?.customPackName
        ? `${member.customPackName} — ${member.customPackAuthor || "Capstone Press 2026"}`
        : "AmbaBot Studio (default)";

    await sendTextMessage(
      waId,
      [
        "📊 *Status Akun AmbaBot Studio*",
        `• Akun Web: ${member ? `${member.fullName} (${member.email})` : "Belum ditautkan"}`,
        `• Paket Aktif: *${isPro ? "PRO CREATOR 👑" : "FREE PLAN"}*`,
        `• Kuota AI Hari Ini: *${usedToday}/${limit}* (sisa ${remaining}x)`,
        `• Nama Pack Stiker: *${packLabel}*`,
        "",
        isPro
          ? `Atur nama pack EXIF kapan saja di: ${APP_URL}/account`
          : `Mau kuota AI 50x/hari & ganti nama pack stiker pakai namamu sendiri? Upgrade ke Pro di: ${APP_URL}/register?plan=pro`,
      ].join("\n")
    );
    return;
  }

  // 7. Ambil status akun tertaut (untuk Kuota Pro & Custom Pack EXIF)
  const linkedMember = await getLinkedUserByWaId(waId);

  // 8. Perintah Stiker Teks (/qc, /brat)
  if (lower === "/qc" || lower.startsWith("/qc ")) {
    await handleQuoteChatMessage(
      waId,
      profileName,
      messageId,
      rawText.slice(3).trim(),
      linkedMember
    );
    return;
  }

  if (lower === "/brat" || lower.startsWith("/brat ")) {
    await handleBratMessage(
      waId,
      profileName,
      messageId,
      rawText.slice(5).trim(),
      linkedMember
    );
    return;
  }

  // 9. Perintah Stiker Gambar (/stiker, /meme, /crop, /aimeme, /roast, /news)
  if (isImageCommand(lower)) {
    if (message.type === "image" && message.image?.id) {
      await handleImageMessage(
        waId,
        profileName,
        messageId,
        message.image.id,
        rawText,
        settings,
        linkedMember
      );
      return;
    }

    await sendTextMessage(
      waId,
      [
        "📸 Perintah ini membutuhkan foto.",
        "Kirim foto dengan caption perintah tersebut.",
        "",
        "Contoh:",
        "• Kirim foto dengan caption `/stiker` atau `/crop`",
        "• Kirim foto dengan caption `/aimeme` atau `/roast`",
        "• Kirim foto dengan caption `/news Headline Berita`",
      ].join("\n")
    );
  }
}

// ============================================================================
// A. Handler Pesan Teks (/qc, /brat)
// ============================================================================
async function handleQuoteChatMessage(
  waId: string,
  profileName: string,
  messageId: string,
  quoteText: string,
  linkedMember: LinkedWaMember | null
) {
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
      exif: resolveMemberExif(linkedMember),
    });

    const mediaId = await uploadStickerMedia(result.buffer);
    await sendStickerMessage(waId, mediaId);

    await insertStickerLog({
      wa_id: waId,
      user_id: linkedMember?.userId ?? null,
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
      user_id: linkedMember?.userId ?? null,
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
}

async function handleBratMessage(
  waId: string,
  profileName: string,
  messageId: string,
  bratText: string,
  linkedMember: LinkedWaMember | null
) {
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
    const result = await createBratSticker({
      text: bratText,
      exif: resolveMemberExif(linkedMember),
    });
    const mediaId = await uploadStickerMedia(result.buffer);
    await sendStickerMessage(waId, mediaId);

    await insertStickerLog({
      wa_id: waId,
      user_id: linkedMember?.userId ?? null,
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
      user_id: linkedMember?.userId ?? null,
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
}

// ============================================================================
// B. Handler Pesan Gambar (/aimeme, /roast, /news, /crop, /stiker)
// ============================================================================
async function handleImageMessage(
  waId: string,
  profileName: string,
  messageId: string,
  incomingMediaId: string,
  rawCaption: string,
  settings: BotSettings,
  linkedMember: LinkedWaMember | null
) {
  await upsertWaUser(waId, profileName);

  const caption = rawCaption.trim();
  const lower = caption.toLowerCase();
  const exif = resolveMemberExif(linkedMember);

  const isAiCommand =
    lower === "/aimeme" ||
    lower.startsWith("/aimeme ") ||
    lower === "/roast" ||
    lower.startsWith("/roast ");

  let aiQuotaRateKey: string | null = null;

  // Guard khusus AI Vision sebelum download gambar dari Meta (hemat bandwidth & kuota Gemini)
  if (isAiCommand) {
    if (!settings.ai_meme_enabled) {
      await sendTextMessage(
        waId,
        "⏸️ Fitur AI Vision (`/aimeme` & `/roast`) sedang dinonaktifkan sementara oleh Admin. Mode `/stiker`, `/crop`, `/news`, `/qc`, dan `/brat` tetap bisa dipakai!"
      );
      return;
    }

    const effectiveLimit = linkedMember?.isProActive
      ? settings.daily_pro_ai_limit
      : settings.daily_ai_limit_per_user;

    const rateKey = `wa:${waId}`;
    const quota = await consumeAiQuota(rateKey, effectiveLimit);

    if (!quota.allowed) {
      const upsellMsg = linkedMember?.isProActive
        ? `⏳ Kuota harian AI Vision Pro kamu sudah habis (${quota.limit}x/hari). Reset otomatis pukul 00:00 WIB.`
        : `⏳ Kuota harian AI Vision gratis kamu sudah habis (${quota.limit}x/hari).\n\n👑 Mau kuota *${settings.daily_pro_ai_limit}x/hari* & ganti nama pack stiker pakai namamu sendiri? Upgrade ke *PRO CREATOR* di:\n${APP_URL}/register?plan=pro`;

      await sendTextMessage(waId, upsellMsg);
      return;
    }

    aiQuotaRateKey = rateKey;
  }

  let commandType: StickerCommandType = "standard";
  let loggedCaption: string | null = caption ? caption.slice(0, 200) : null;
  const totalStart = Date.now();

  try {
    const imageBuffer = await downloadWhatsAppMedia(incomingMediaId);
    let result: StickerResult;

    if (isAiCommand) {
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
        exif,
      });
    } else if (lower === "/news" || lower.startsWith("/news ")) {
      commandType = "breaking_news";
      const headline =
        caption.slice(5).trim() || "BERITA TERKINI HARI INI";
      loggedCaption = headline.slice(0, 200);

      result = await createBreakingNewsSticker(imageBuffer, {
        headline,
        exif,
      });
    } else if (lower === "/crop" || lower.startsWith("/crop ")) {
      commandType = "crop";
      result = await processImageToSticker(imageBuffer, {
        mode: "cover",
        exif,
      });
    } else if (caption.includes("|")) {
      commandType = "meme_text";
      const cleaned = caption.replace(/^\/(stiker|meme)\s*/i, "");
      const [topText = "", bottomText = ""] = cleaned
        .split("|")
        .map((s) => s.trim());

      result = await processImageToSticker(imageBuffer, {
        topText,
        bottomText,
        mode: "contain",
        exif,
      });
    } else {
      commandType = "standard";
      result = await processImageToSticker(imageBuffer, {
        mode: "contain",
        exif,
      });
    }

    const totalProcessMs =
      commandType === "ai_meme"
        ? Date.now() - totalStart
        : result.processingTimeMs;

    const uploadedMediaId = await uploadStickerMedia(result.buffer);
    await sendStickerMessage(waId, uploadedMediaId);

    await insertStickerLog({
      wa_id: waId,
      user_id: linkedMember?.userId ?? null,
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

    if (aiQuotaRateKey) {
      await refundAiQuota(aiQuotaRateKey);
    }

    await insertStickerLog({
      wa_id: waId,
      user_id: linkedMember?.userId ?? null,
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
