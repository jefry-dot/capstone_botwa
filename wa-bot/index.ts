import fs from "fs";
import path from "path";
import { createRequire } from "module";
import { fileURLToPath } from "url";
import dotenv from "dotenv";
import pino from "pino";
import qrcode from "qrcode-terminal";
import sharp from "sharp";
import { Boom } from "@hapi/boom";
import makeWASocket, {
  DisconnectReason,
  downloadMediaMessage,
  fetchLatestBaileysVersion,
  useMultiFileAuthState,
  type WAMessage,
  type proto,
} from "@whiskeysockets/baileys";

import { getSupabaseAdmin } from "../src/lib/supabase";
import { generateAiMemeCaption, type AiMemeMode } from "../src/lib/gemini";
import {
  getBotSettings,
  isWaUserBlocked,
  consumeAiQuota,
  type BotSettings,
} from "../src/lib/bot-guard";
import {
  processImageToSticker,
  createQuoteBubbleSticker,
  createBratSticker,
  createBreakingNewsSticker,
  type StickerResult,
} from "../src/lib/sticker-processor";
import type { StickerCommandType, StickerLogInsert } from "../src/types/database";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const ROOT_DIR = path.resolve(__dirname, "..");

// Pastikan FONTCONFIG_PATH mengarah ke folder fonts/ di root agar SVG render tajam
process.env.FONTCONFIG_PATH = path.join(ROOT_DIR, "fonts");
process.env.FONTCONFIG_FILE = path.join(ROOT_DIR, "fonts", "fonts.conf");

// Muat environment variables dari root .env.local
dotenv.config({ path: path.join(ROOT_DIR, ".env.local") });

const AUTH_DIR = path.join(__dirname, "auth_info");
const QR_PNG_PATH = path.join(__dirname, "qr.png");
const require = createRequire(import.meta.url);

async function saveQrCodePng(qrText: string) {
  try {
    const QRCode = require("qrcode-terminal/vendor/QRCode");
    const QRErrorCorrectLevel = require("qrcode-terminal/vendor/QRCode/QRErrorCorrectLevel");
    const qrObj = new QRCode(-1, QRErrorCorrectLevel.L);
    qrObj.addData(qrText);
    qrObj.make();

    const count: number = qrObj.getModuleCount();
    const quiet = 4;
    const cell = 8;
    const size = (count + quiet * 2) * cell;

    const rects: string[] = [];
    for (let r = 0; r < count; r++) {
      for (let c = 0; c < count; c++) {
        if (qrObj.isDark(r, c)) {
          const x = (c + quiet) * cell;
          const y = (r + quiet) * cell;
          rects.push(`<rect x="${x}" y="${y}" width="${cell}" height="${cell}" fill="#000000"/>`);
        }
      }
    }

    const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}" viewBox="0 0 ${size} ${size}"><rect width="100%" height="100%" fill="#FFFFFF"/>${rects.join("")}</svg>`;
    await sharp(Buffer.from(svg)).png().toFile(QR_PNG_PATH);
    console.log(`🖼️  [WA-BOT] QR Code PNG diperbarui: ${QR_PNG_PATH}`);
  } catch (err) {
    console.error("[WA-BOT] Gagal menyimpan qr.png:", err);
  }
}

const HELP_MESSAGE = [
  "🎨 *WA AI Sticker Studio — Daftar Perintah*",
  "",
  "📸 *Kirim atau Reply Foto dengan Caption:*",
  "• `/stiker` → Stiker transparan",
  "• `/crop` → Stiker penuh 1:1 (kotak)",
  "• `/stiker Atas | Bawah` → Meme klasik",
  "• `/aimeme` → AI otomatis bikin caption meme dari foto",
  "• `/roast` → AI otomatis roasting foto secara lucu",
  "• `/news Headline Berita` → Frame TV Breaking News",
  "",
  "💬 *Kirim Teks Saja (atau Reply Pesan):*",
  "• `/qc Isi pesan chat` → Stiker bubble chat WA",
  "• `/brat teks kamu` → Stiker tipografi Brat hijau",
  "",
  "🌐 *Web Studio:* https://capstone-botwa.vercel.app",
  "Ketik `/help` kapan saja untuk melihat panduan ini lagi.",
].join("\n");

// ============================================================================
// Helper: Supabase Logging & Upsert User
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
// Helper: Ekstrak JID, Nomor WA, Teks, dan Quoted Media
// ============================================================================
function normalizeWaId(jid: string): string {
  // Ubah '628123456789:12@s.whatsapp.net' -> '628123456789'
  return jid.split("@")[0].split(":")[0].replace(/\D/g, "") || jid;
}

function unwrapMessageContent(
  msg?: proto.IMessage | null
): proto.IMessage | null {
  if (!msg) return null;
  if (msg.ephemeralMessage?.message) {
    return unwrapMessageContent(msg.ephemeralMessage.message);
  }
  if (msg.viewOnceMessage?.message) {
    return unwrapMessageContent(msg.viewOnceMessage.message);
  }
  if (msg.viewOnceMessageV2?.message) {
    return unwrapMessageContent(msg.viewOnceMessageV2.message);
  }
  return msg;
}

function extractTextAndCaption(content: proto.IMessage): string {
  return (
    content.conversation ||
    content.extendedTextMessage?.text ||
    content.imageMessage?.caption ||
    ""
  ).trim();
}

function getQuotedContext(content: proto.IMessage): proto.IContextInfo | null {
  return (
    content.extendedTextMessage?.contextInfo ||
    content.imageMessage?.contextInfo ||
    null
  );
}

function isCommandText(text: string): boolean {
  const lower = text.trim().toLowerCase();
  return (
    lower === "/help" ||
    lower === "/menu" ||
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
    lower.startsWith("/news ") ||
    lower === "/qc" ||
    lower.startsWith("/qc ") ||
    lower === "/brat" ||
    lower.startsWith("/brat ")
  );
}

// ============================================================================
// Main Bot Startup (Auto-Reconnect + QR Terminal)
// ============================================================================
async function startBot() {
  const { state, saveCreds } = await useMultiFileAuthState(AUTH_DIR);
  const { version } = await fetchLatestBaileysVersion();

  const sock = makeWASocket({
    version,
    auth: state,
    logger: pino({ level: "silent" }),
    browser: ["WA AI Sticker Studio", "Chrome", "1.0.0"],
    printQRInTerminal: false,
  });

  sock.ev.on("creds.update", saveCreds);

  sock.ev.on("connection.update", (update) => {
    const { connection, lastDisconnect, qr } = update;

    if (qr) {
      console.log("\n========================================================");
      console.log("📱 SCAN QR CODE INI PAKAI WHATSAPP NOMOR TUMBAL KAMU:");
      console.log("   (WhatsApp -> Perangkat Tertaut -> Tautkan Perangkat)");
      console.log("========================================================\n");
      qrcode.generate(qr, { small: true });
      void saveQrCodePng(qr);
    }

    if (connection === "open") {
      if (fs.existsSync(QR_PNG_PATH)) {
        fs.unlinkSync(QR_PNG_PATH);
      }
      console.log("\n✅ [WA-BOT] TERHUBUNG! Bot siap menerima pesan dari SEMUA orang & grup.");
      console.log("   Log & pengaturan admin otomatis tersinkron ke Supabase & Dashboard Vercel.\n");
    }

    if (connection === "close") {
      const statusCode = (lastDisconnect?.error as Boom | undefined)?.output
        ?.statusCode;
      const shouldReconnect = statusCode !== DisconnectReason.loggedOut;

      console.log(
        `⚠️ [WA-BOT] Koneksi terputus (code: ${statusCode ?? "unknown"}).`,
        shouldReconnect ? "Menyambung ulang dalam 3 detik..." : "Session logout."
      );

      if (shouldReconnect) {
        setTimeout(() => {
          void startBot();
        }, 3000);
      } else {
        console.log(
          "🔴 Sesi WhatsApp keluar (Logged Out). Hapus folder 'wa-bot/auth_info' lalu jalankan ulang 'npm run bot' untuk scan QR baru."
        );
      }
    }
  });

  sock.ev.on("messages.upsert", async ({ messages, type }) => {
    if (type !== "notify") return;

    for (const msg of messages) {
      try {
        await handleIncomingMessage(sock, msg);
      } catch (err) {
        console.error("[WA-BOT] Unhandled message error:", err);
      }
    }
  });
}

// ============================================================================
// Message Router (Private Chat & Group Chat)
// ============================================================================
async function handleIncomingMessage(
  sock: ReturnType<typeof makeWASocket>,
  msg: WAMessage
) {
  const remoteJid = msg.key.remoteJid;
  if (!remoteJid || remoteJid === "status@broadcast" || msg.key.fromMe) {
    return;
  }

  const content = unwrapMessageContent(msg.message);
  if (!content) return;

  const isGroup = remoteJid.endsWith("@g.us");
  const senderJid = isGroup ? msg.key.participant || remoteJid : remoteJid;
  const waId = normalizeWaId(senderJid);
  const profileName = msg.pushName?.trim() || "User WA";
  const messageId = msg.key.id || `baileys-${Date.now()}`;

  const text = extractTextAndCaption(content);
  const lower = text.toLowerCase();
  const hasDirectImage = Boolean(content.imageMessage);

  const quotedCtx = getQuotedContext(content);
  const quotedContent = unwrapMessageContent(quotedCtx?.quotedMessage);
  const hasQuotedImage = Boolean(quotedContent?.imageMessage);
  const quotedText = quotedContent ? extractTextAndCaption(quotedContent) : "";

  // Abaikan seluruh pesan (baik di DM maupun di GRUP) yang tidak diawali perintah valid
  if (!isCommandText(text)) {
    return;
  }

  console.log(
    `📩 [WA-BOT] ${isGroup ? "[GRUP]" : "[DM]"} ${profileName} (${waId}): ${
      hasDirectImage ? "[FOTO] " : ""
    }${text || "(tanpa caption)"}`
  );

  // 1. Cek blokir dari Admin Dashboard (wa_users.is_blocked)
  if (await isWaUserBlocked(waId)) {
    console.log(`🚫 [Guard] Mengabaikan user diblokir: ${waId}`);
    return;
  }

  // 2. Cek Maintenance Mode dari Admin Dashboard (bot_settings)
  const settings = await getBotSettings();
  if (settings.maintenance_mode) {
    await sock.sendMessage(
      remoteJid,
      { text: `🛠️ *Mode Pemeliharaan*\n${settings.maintenance_message}` },
      { quoted: msg }
    );
    return;
  }

  // 3. Handler Perintah Teks (/qc, /brat)
  if (lower === "/qc" || lower.startsWith("/qc ")) {
    const quoteInput = text.slice(3).trim() || quotedText;
    if (!quoteInput) {
      await sock.sendMessage(
        remoteJid,
        {
          text: "Format salah. Contoh:\n`/qc Besok bimbingan jam 8 jangan telat!`\nAtau *reply* pesan temanmu dengan `/qc`.",
        },
        { quoted: msg }
      );
      return;
    }

    await handleQuoteChat(sock, msg, remoteJid, waId, profileName, messageId, quoteInput);
    return;
  }

  if (lower === "/brat" || lower.startsWith("/brat ")) {
    const bratInput = text.slice(5).trim() || quotedText;
    if (!bratInput) {
      await sock.sendMessage(
        remoteJid,
        { text: "Format salah. Contoh:\n`/brat lagi pusing revisi bab 4`" },
        { quoted: msg }
      );
      return;
    }

    await handleBrat(sock, msg, remoteJid, waId, profileName, messageId, bratInput);
    return;
  }

  // 4. Handler Foto Langsung ATAU Reply Foto dengan Perintah
  if (hasDirectImage || (hasQuotedImage && isCommandText(text))) {
    const targetMsg: WAMessage = hasDirectImage
      ? msg
      : ({
          key: {
            remoteJid,
            id: quotedCtx?.stanzaId || messageId,
            participant: quotedCtx?.participant || undefined,
          },
          message: quotedContent!,
        } as WAMessage);

    await handleImageSticker(
      sock,
      msg,
      targetMsg,
      remoteJid,
      waId,
      profileName,
      messageId,
      text,
      settings
    );
    return;
  }

  // 5. Menu / Help (hanya merespons /help atau /menu)
  if (lower === "/help" || lower === "/menu") {
    await sock.sendMessage(remoteJid, { text: HELP_MESSAGE }, { quoted: msg });
  }
}

// ============================================================================
// Handler: Mode Quote Chat (/qc)
// ============================================================================
async function handleQuoteChat(
  sock: ReturnType<typeof makeWASocket>,
  msg: WAMessage,
  remoteJid: string,
  waId: string,
  profileName: string,
  messageId: string,
  quoteText: string
) {
  await upsertWaUser(waId, profileName);
  const startTime = Date.now();

  try {
    const result = await createQuoteBubbleSticker({
      name: profileName,
      text: quoteText,
    });

    await sock.sendMessage(remoteJid, { sticker: result.buffer }, { quoted: msg });

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
    console.log(`✅ [WA-BOT /qc] Terkirim (${result.sizeKb} KB, ${result.processingTimeMs} ms)`);
  } catch (err) {
    const errMsg = err instanceof Error ? err.message : "Unknown error";
    console.error("[WA-BOT /qc] Error:", errMsg);

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

    await sock.sendMessage(
      remoteJid,
      { text: "Gagal bikin stiker /qc nih, coba lagi ya." },
      { quoted: msg }
    );
  }
}

// ============================================================================
// Handler: Mode Brat Text (/brat)
// ============================================================================
async function handleBrat(
  sock: ReturnType<typeof makeWASocket>,
  msg: WAMessage,
  remoteJid: string,
  waId: string,
  profileName: string,
  messageId: string,
  bratText: string
) {
  await upsertWaUser(waId, profileName);
  const startTime = Date.now();

  try {
    const result = await createBratSticker({ text: bratText });
    await sock.sendMessage(remoteJid, { sticker: result.buffer }, { quoted: msg });

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
    console.log(`✅ [WA-BOT /brat] Terkirim (${result.sizeKb} KB, ${result.processingTimeMs} ms)`);
  } catch (err) {
    const errMsg = err instanceof Error ? err.message : "Unknown error";
    console.error("[WA-BOT /brat] Error:", errMsg);

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

    await sock.sendMessage(
      remoteJid,
      { text: "Gagal bikin stiker /brat nih, coba lagi ya." },
      { quoted: msg }
    );
  }
}

// ============================================================================
// Handler: Mode Gambar (/stiker, /crop, Meme, /aimeme, /roast, /news)
// ============================================================================
async function handleImageSticker(
  sock: ReturnType<typeof makeWASocket>,
  originalMsg: WAMessage,
  mediaMsg: WAMessage,
  remoteJid: string,
  waId: string,
  profileName: string,
  messageId: string,
  rawCaption: string,
  settings: BotSettings
) {
  await upsertWaUser(waId, profileName);

  const caption = rawCaption.trim();
  const lower = caption.toLowerCase();

  let commandType: StickerCommandType = "standard";
  let loggedCaption: string | null = caption ? caption.slice(0, 200) : null;
  const totalStart = Date.now();

  const isAiCommand =
    lower === "/aimeme" ||
    lower.startsWith("/aimeme ") ||
    lower === "/roast" ||
    lower.startsWith("/roast ");

  if (isAiCommand) {
    if (!settings.ai_meme_enabled) {
      await sock.sendMessage(
        remoteJid,
        {
          text: "⏸️ Fitur AI Vision (`/aimeme` & `/roast`) sedang dinonaktifkan sementara oleh Admin. Mode `/stiker`, `/crop`, `/qc`, `/brat`, dan `/news` tetap bisa dipakai!",
        },
        { quoted: originalMsg }
      );
      return;
    }

    const quota = await consumeAiQuota(
      `wa:${waId}`,
      settings.daily_ai_limit_per_user
    );
    if (!quota.allowed) {
      await sock.sendMessage(
        remoteJid,
        {
          text: `⏳ Kuota harian AI Vision kamu sudah habis (${quota.limit}x/hari). Coba lagi besok atau gunakan mode lain seperti \`/stiker Atas | Bawah\`, \`/news\`, \`/qc\`, atau \`/brat\`.`,
        },
        { quoted: originalMsg }
      );
      return;
    }
  }

  try {
    const mediaBuffer = (await downloadMediaMessage(
      mediaMsg,
      "buffer",
      {},
      {
        logger: pino({ level: "silent" }),
        reuploadRequest: sock.updateMediaMessage,
      }
    )) as Buffer;

    let result: StickerResult;

    if (isAiCommand) {
      commandType = "ai_meme";
      const aiMode: AiMemeMode = lower.startsWith("/roast") ? "roast" : "aimeme";
      const aiCaption = await generateAiMemeCaption(mediaBuffer, aiMode);
      loggedCaption = `[${aiMode}] ${aiCaption.topText} | ${aiCaption.bottomText}`.slice(
        0,
        200
      );

      result = await processImageToSticker(mediaBuffer, {
        topText: aiCaption.topText,
        bottomText: aiCaption.bottomText,
        mode: "contain",
      });
    } else if (lower === "/news" || lower.startsWith("/news ")) {
      commandType = "breaking_news";
      const headline = caption.slice(5).trim() || "BERITA TERKINI HARI INI";
      loggedCaption = headline.slice(0, 200);
      result = await createBreakingNewsSticker(mediaBuffer, { headline });
    } else if (lower === "/crop" || lower.startsWith("/crop ")) {
      commandType = "crop";
      result = await processImageToSticker(mediaBuffer, { mode: "cover" });
    } else if (caption.includes("|")) {
      commandType = "meme_text";
      const cleaned = caption.replace(/^\/(stiker|meme)\s*/i, "");
      const [topText = "", bottomText = ""] = cleaned
        .split("|")
        .map((s) => s.trim());

      result = await processImageToSticker(mediaBuffer, {
        topText,
        bottomText,
        mode: "contain",
      });
    } else {
      commandType = "standard";
      result = await processImageToSticker(mediaBuffer, { mode: "contain" });
    }

    const totalProcessMs =
      commandType === "ai_meme"
        ? Date.now() - totalStart
        : result.processingTimeMs;

    await sock.sendMessage(
      remoteJid,
      { sticker: result.buffer },
      { quoted: originalMsg }
    );

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
    console.log(
      `✅ [WA-BOT ${commandType}] Terkirim (${result.sizeKb} KB, ${totalProcessMs} ms)`
    );
  } catch (err) {
    const errMsg = err instanceof Error ? err.message : "Unknown error";
    console.error(`[WA-BOT Image - ${commandType}] Error:`, errMsg);

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

    await sock.sendMessage(
      remoteJid,
      {
        text: "Waduh, gagal memproses fotomu jadi stiker 😅 Pastikan gambarnya jelas dan coba kirim ulang ya.",
      },
      { quoted: originalMsg }
    );
  }
}

void startBot();
