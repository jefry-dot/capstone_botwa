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
  refundAiQuota,
  getTodayAiUsage,
  getLinkedUserByWaId,
  verifyAndLinkWaCode,
  type BotSettings,
  type LinkedWaMember,
} from "../src/lib/bot-guard";
import {
  processImageToSticker,
  createQuoteBubbleSticker,
  createBratSticker,
  createBreakingNewsSticker,
  type StickerExifOptions,
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
          rects.push(
            `<rect x="${x}" y="${y}" width="${cell}" height="${cell}" fill="#000000"/>`
          );
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

const APP_URL = (
  process.env.NEXT_PUBLIC_APP_URL || "https://capstone-botwa.vercel.app"
).replace(/\/+$/, "");

const HELP_MESSAGE = [
  "🎨 *AmbaBot Studio — Daftar Perintah*",
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
  "👑 *Akun & Paket Pro:*",
  "• `/status` → Cek paket (Free/Pro), sisa kuota AI & Pack EXIF",
  "• `/link <kode>` → Tautkan WA ke akun web untuk aktifkan Pro",
  "",
  `🌐 *Portal Akun & Upgrade Pro:* ${APP_URL}`,
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

function resolveMemberExif(
  member: LinkedWaMember | null
): StickerExifOptions | undefined {
  if (!member?.isProActive) return undefined;
  return {
    packName: member.customPackName,
    packPublisher: member.customPackAuthor,
  };
}

// ============================================================================
// Helper: Ekstrak JID, Resolusi LID -> Nomor HP, Dedup Pesan, & Nama Pengirim
// ============================================================================
const MAX_PUSH_NAME_CACHE = 2000;
const MAX_LID_CACHE = 4000;
const GROUP_META_TTL_MS = 10 * 60 * 1000;
const MESSAGE_DEDUP_TTL_MS = 5 * 60 * 1000;

const knownPushNames = new Map<string, string>();
const lidToPhoneWaId = new Map<string, string>();
const groupMetaFetchedAt = new Map<string, number>();
const processedMessageIds = new Map<string, number>();

function isDuplicateMessageId(messageId: string): boolean {
  const now = Date.now();
  for (const [id, ts] of processedMessageIds.entries()) {
    if (now - ts > MESSAGE_DEDUP_TTL_MS) {
      processedMessageIds.delete(id);
    }
  }
  if (processedMessageIds.has(messageId)) {
    return true;
  }
  processedMessageIds.set(messageId, now);
  return false;
}

function rememberPushName(waId: string, pushName?: string | null) {
  const cleaned = pushName?.trim();
  if (!waId || !cleaned) return;
  if (!knownPushNames.has(waId) && knownPushNames.size >= MAX_PUSH_NAME_CACHE) {
    const oldestKey = knownPushNames.keys().next().value;
    if (oldestKey) knownPushNames.delete(oldestKey);
  }
  knownPushNames.set(waId, cleaned);
}

function normalizeWaId(jid: string): string {
  return jid.split("@")[0].split(":")[0].replace(/\D/g, "") || jid;
}

function isPhoneJid(jid?: string | null): jid is string {
  return Boolean(jid && jid.endsWith("@s.whatsapp.net"));
}

function rememberLidMapping(lidJid?: string | null, phoneJid?: string | null) {
  if (!lidJid || !phoneJid || !isPhoneJid(phoneJid)) return;
  const lidKey = normalizeWaId(lidJid);
  const phoneWaId = normalizeWaId(phoneJid);
  if (!lidKey || !phoneWaId || lidKey === phoneWaId) return;

  if (!lidToPhoneWaId.has(lidKey) && lidToPhoneWaId.size >= MAX_LID_CACHE) {
    const oldestKey = lidToPhoneWaId.keys().next().value;
    if (oldestKey) lidToPhoneWaId.delete(oldestKey);
  }
  lidToPhoneWaId.set(lidKey, phoneWaId);
}

async function syncGroupLidMappings(
  sock: ReturnType<typeof makeWASocket>,
  groupJid: string
): Promise<void> {
  const lastFetched = groupMetaFetchedAt.get(groupJid) ?? 0;
  if (Date.now() - lastFetched < GROUP_META_TTL_MS) return;
  groupMetaFetchedAt.set(groupJid, Date.now());

  try {
    const meta = await sock.groupMetadata(groupJid);
    for (const participant of meta.participants ?? []) {
      const candidatePhone = isPhoneJid(participant.jid)
        ? participant.jid
        : isPhoneJid(participant.id)
          ? participant.id
          : null;
      const candidateLid = participant.lid?.endsWith("@lid")
        ? participant.lid
        : participant.id.endsWith("@lid")
          ? participant.id
          : null;

      if (candidateLid && candidatePhone) {
        rememberLidMapping(candidateLid, candidatePhone);
      }
      const resolvedId = candidatePhone
        ? normalizeWaId(candidatePhone)
        : normalizeWaId(participant.id);
      if (participant.notify || participant.name) {
        rememberPushName(resolvedId, participant.notify || participant.name);
      }
    }
  } catch {
    // Abaikan jika bot tidak punya akses metadata grup
  }
}

async function resolveSenderWaId(
  sock: ReturnType<typeof makeWASocket>,
  msg: WAMessage,
  isGroup: boolean,
  remoteJid: string
): Promise<string> {
  // Rekam pasangan LID <-> Phone Number jika tersedia langsung di key Baileys
  if (msg.key.participantLid && msg.key.participantPn) {
    rememberLidMapping(msg.key.participantLid, msg.key.participantPn);
  }
  if (msg.key.senderLid && msg.key.senderPn) {
    rememberLidMapping(msg.key.senderLid, msg.key.senderPn);
  }

  const directPhoneJid = isGroup ? msg.key.participantPn : msg.key.senderPn;
  if (isPhoneJid(directPhoneJid)) {
    return normalizeWaId(directPhoneJid);
  }

  const rawSenderJid = isGroup ? msg.key.participant || remoteJid : remoteJid;
  const rawId = normalizeWaId(rawSenderJid);

  if (rawSenderJid.endsWith("@lid")) {
    const cached = lidToPhoneWaId.get(rawId);
    if (cached) return cached;

    if (isGroup) {
      await syncGroupLidMappings(sock, remoteJid);
      const afterSync = lidToPhoneWaId.get(rawId);
      if (afterSync) return afterSync;
    }
  }

  return rawId;
}

async function resolveQuotedAuthorName(
  sock: ReturnType<typeof makeWASocket>,
  quotedCtx: proto.IContextInfo | null,
  isGroup: boolean,
  remoteJid: string,
  senderWaId: string,
  fallbackName: string
): Promise<string> {
  const quotedJid = quotedCtx?.participant || (!isGroup ? remoteJid : null);
  if (!quotedJid) return fallbackName;

  let quotedWaId = normalizeWaId(quotedJid);
  if (quotedJid.endsWith("@lid")) {
    const mapped = lidToPhoneWaId.get(quotedWaId);
    if (mapped) {
      quotedWaId = mapped;
    } else if (isGroup) {
      await syncGroupLidMappings(sock, remoteJid);
      quotedWaId = lidToPhoneWaId.get(quotedWaId) ?? quotedWaId;
    }
  }

  if (!quotedWaId || quotedWaId === senderWaId) return fallbackName;

  const botWaId = sock.user?.id ? normalizeWaId(sock.user.id) : null;
  if (botWaId && quotedWaId === botWaId) {
    return "AmbaBot Studio";
  }

  const cached = knownPushNames.get(quotedWaId);
  if (cached) return cached;

  try {
    const supabase = getSupabaseAdmin();
    const { data } = await supabase
      .from("wa_users")
      .select("profile_name")
      .eq("wa_id", quotedWaId)
      .maybeSingle<{ profile_name: string | null }>();

    if (data?.profile_name?.trim()) {
      rememberPushName(quotedWaId, data.profile_name);
      return data.profile_name.trim();
    }
  } catch {
    // Abaikan jika lookup gagal; gunakan fallback
  }

  return /^\d{8,15}$/.test(quotedWaId) ? `+${quotedWaId}` : "Teman WA";
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
// Main Bot Startup (Auto-Reconnect + QR Terminal & PNG)
// ============================================================================
let reconnectTimer: ReturnType<typeof setTimeout> | null = null;

async function startBot() {
  if (reconnectTimer) {
    clearTimeout(reconnectTimer);
    reconnectTimer = null;
  }

  const { state, saveCreds } = await useMultiFileAuthState(AUTH_DIR);
  const { version } = await fetchLatestBaileysVersion();

  const sock = makeWASocket({
    version,
    auth: state,
    logger: pino({ level: "silent" }),
    browser: ["AmbaBot Studio", "Chrome", "1.0.0"],
    printQRInTerminal: false,
  });

  sock.ev.on("creds.update", saveCreds);

  const indexContacts = (
    contacts: Array<{
      id?: string;
      lid?: string;
      jid?: string;
      notify?: string;
      name?: string;
    }>
  ) => {
    for (const c of contacts) {
      const phoneJid = isPhoneJid(c.jid)
        ? c.jid
        : isPhoneJid(c.id)
          ? c.id
          : null;
      const lidJid = c.lid?.endsWith("@lid")
        ? c.lid
        : c.id?.endsWith("@lid")
          ? c.id
          : null;
      if (lidJid && phoneJid) {
        rememberLidMapping(lidJid, phoneJid);
      }
      if (phoneJid && (c.notify || c.name)) {
        rememberPushName(normalizeWaId(phoneJid), c.notify || c.name);
      }
    }
  };

  sock.ev.on("contacts.upsert", indexContacts);
  sock.ev.on("contacts.update", indexContacts);

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
      console.log(
        "\n✅ [WA-BOT] TERHUBUNG! Bot siap menerima perintah (/help, /stiker, /aimeme, /qc, /brat, /news, /link, /status)."
      );
      console.log(
        "   Sinkronisasi Pro Plan, Custom EXIF, & Dashboard Admin aktif.\n"
      );
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
        if (!reconnectTimer) {
          reconnectTimer = setTimeout(() => {
            reconnectTimer = null;
            void startBot();
          }, 3000);
        }
      } else {
        console.log(
          "🔴 Sesi WhatsApp keluar (Logged Out). Hapus folder 'wa-bot/auth_info' lalu jalankan ulang 'npm run bot' untuk scan QR baru."
        );
      }
    }
  });

  sock.ev.on("messages.upsert", async ({ messages, type }) => {
    if (type !== "notify") return;

    const results = await Promise.allSettled(
      messages.map((msg) => handleIncomingMessage(sock, msg))
    );
    for (const res of results) {
      if (res.status === "rejected") {
        console.error("[WA-BOT] Unhandled message error:", res.reason);
      }
    }
  });
}

// ============================================================================
// Message Router (Strict Command-Only Mode + Pro Plan Sync)
// ============================================================================
async function handleIncomingMessage(
  sock: ReturnType<typeof makeWASocket>,
  msg: WAMessage
) {
  const remoteJid = msg.key.remoteJid;
  if (!remoteJid || remoteJid === "status@broadcast" || msg.key.fromMe) {
    return;
  }

  const messageId = msg.key.id || `baileys-${Date.now()}`;
  if (msg.key.id && isDuplicateMessageId(msg.key.id)) {
    return;
  }

  const content = unwrapMessageContent(msg.message);
  if (!content) return;

  const isGroup = remoteJid.endsWith("@g.us");
  const waId = await resolveSenderWaId(sock, msg, isGroup, remoteJid);
  const profileName = msg.pushName?.trim() || "User WA";

  // Simpan cache nama pengirim dari semua pesan masuk agar fitur reply /qc menampilkan nama teman yang tepat
  rememberPushName(waId, msg.pushName);

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
    }${text}`
  );

  // 1. Cek blokir dari Admin Dashboard (wa_users.is_blocked)
  if (await isWaUserBlocked(waId)) {
    console.log(`🚫 [Guard] Mengabaikan user diblokir: ${waId}`);
    return;
  }

  // 2. Cek Maintenance Mode global dari Admin Dashboard (bot_settings)
  const settings = await getBotSettings();
  if (settings.maintenance_mode) {
    await sock.sendMessage(
      remoteJid,
      { text: `🛠️ *Mode Pemeliharaan*\n${settings.maintenance_message}` },
      { quoted: msg }
    );
    return;
  }

  // 3. Perintah Tautkan Akun Web (/link <kode>)
  if (lower === "/link" || lower.startsWith("/link ")) {
    const code = text.slice(5).trim();
    await upsertWaUser(waId, profileName);
    const res = await verifyAndLinkWaCode(code, waId);

    if (!res.ok) {
      await sock.sendMessage(remoteJid, { text: `❌ ${res.message}` }, { quoted: msg });
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

    await sock.sendMessage(
      remoteJid,
      {
        text: [
          `✅ *Berhasil terhubung ke akun ${member.fullName}!*`,
          `• Email: ${member.email}`,
          `• Paket: *${member.isProActive ? "PRO CREATOR 👑" : "FREE PLAN"}*`,
          `• Kuota AI Harian: *${limit}x / hari*`,
          `• Pack Stiker EXIF: *${packLabel}*`,
          "",
          "Semua stiker yang kamu buat di WA sekarang otomatis tersinkron ke halaman *Akun Saya* di website!",
        ].join("\n"),
      },
      { quoted: msg }
    );
    return;
  }

  // 4. Perintah Cek Status Paket & Kuota (/status)
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

    await sock.sendMessage(
      remoteJid,
      {
        text: [
          "📊 *Status Akun AmbaBot Studio*",
          `• Akun Web: ${member ? `${member.fullName} (${member.email})` : "Belum ditautkan"}`,
          `• Paket Aktif: *${isPro ? "PRO CREATOR 👑" : "FREE PLAN"}*`,
          `• Kuota AI Hari Ini: *${usedToday}/${limit}* (sisa ${remaining}x)`,
          `• Nama Pack Stiker: *${packLabel}*`,
          "",
          isPro
            ? `Atur nama pack EXIF kapan saja di: ${APP_URL}/account`
            : `Mau kuota AI 50x/hari & ganti nama pack stiker pakai namamu sendiri? Upgrade ke Pro di: ${APP_URL}/register?plan=pro`,
        ].join("\n"),
      },
      { quoted: msg }
    );
    return;
  }

  // 5. Menu / Help (diproses sebelum handler foto agar reply foto dengan /help tetap membalas panduan)
  if (lower === "/help" || lower === "/menu") {
    await sock.sendMessage(remoteJid, { text: HELP_MESSAGE }, { quoted: msg });
    return;
  }

  // 6. Ambil status akun tertaut (untuk Kuota Pro & Custom Pack EXIF)
  const linkedMember = await getLinkedUserByWaId(waId);

  // 7. Handler Perintah Teks (/qc, /brat)
  if (lower === "/qc" || lower.startsWith("/qc ")) {
    const explicitQuoteText = text.slice(3).trim();
    const quoteInput = explicitQuoteText || quotedText;
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

    const quoteAuthorName =
      !explicitQuoteText && quotedText
        ? await resolveQuotedAuthorName(
            sock,
            quotedCtx,
            isGroup,
            remoteJid,
            waId,
            profileName
          )
        : profileName;

    await handleQuoteChat(
      sock,
      msg,
      remoteJid,
      waId,
      profileName,
      quoteAuthorName,
      messageId,
      quoteInput,
      linkedMember
    );
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

    await handleBrat(
      sock,
      msg,
      remoteJid,
      waId,
      profileName,
      messageId,
      bratInput,
      linkedMember
    );
    return;
  }

  // 8. Handler Foto Langsung ATAU Reply Foto dengan Perintah Gambar
  if (isImageCommand(lower)) {
    if (!hasDirectImage && !hasQuotedImage) {
      await sock.sendMessage(
        remoteJid,
        {
          text: [
            "📸 Perintah ini membutuhkan foto.",
            "Kirim foto dengan caption perintah tersebut, atau *reply* sebuah foto dengan perintahnya.",
            "",
            "Contoh:",
            "• Kirim/reply foto dengan `/stiker` atau `/crop`",
            "• Kirim/reply foto dengan `/aimeme` atau `/roast`",
            "• Kirim/reply foto dengan `/news Headline Berita`",
          ].join("\n"),
        },
        { quoted: msg }
      );
      return;
    }

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
      settings,
      linkedMember
    );
    return;
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
  quoteAuthorName: string,
  messageId: string,
  quoteText: string,
  linkedMember: LinkedWaMember | null
) {
  await upsertWaUser(waId, profileName);
  const startTime = Date.now();

  try {
    const result = await createQuoteBubbleSticker({
      name: quoteAuthorName,
      text: quoteText,
      exif: resolveMemberExif(linkedMember),
    });

    await sock.sendMessage(remoteJid, { sticker: result.buffer }, { quoted: msg });

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
    console.log(
      `✅ [WA-BOT /qc] Terkirim (${result.sizeKb} KB, ${result.processingTimeMs} ms)${
        linkedMember?.isProActive ? " [PRO]" : ""
      }`
    );
  } catch (err) {
    const errMsg = err instanceof Error ? err.message : "Unknown error";
    console.error("[WA-BOT /qc] Error:", errMsg);

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
  bratText: string,
  linkedMember: LinkedWaMember | null
) {
  await upsertWaUser(waId, profileName);
  const startTime = Date.now();

  try {
    const result = await createBratSticker({
      text: bratText,
      exif: resolveMemberExif(linkedMember),
    });
    await sock.sendMessage(remoteJid, { sticker: result.buffer }, { quoted: msg });

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
    console.log(
      `✅ [WA-BOT /brat] Terkirim (${result.sizeKb} KB, ${result.processingTimeMs} ms)${
        linkedMember?.isProActive ? " [PRO]" : ""
      }`
    );
  } catch (err) {
    const errMsg = err instanceof Error ? err.message : "Unknown error";
    console.error("[WA-BOT /brat] Error:", errMsg);

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
  settings: BotSettings,
  linkedMember: LinkedWaMember | null
) {
  await upsertWaUser(waId, profileName);

  const caption = rawCaption.trim();
  const lower = caption.toLowerCase();

  let commandType: StickerCommandType = "standard";
  let loggedCaption: string | null = caption ? caption.slice(0, 200) : null;
  const totalStart = Date.now();
  const exif = resolveMemberExif(linkedMember);

  const isAiCommand =
    lower === "/aimeme" ||
    lower.startsWith("/aimeme ") ||
    lower === "/roast" ||
    lower.startsWith("/roast ");

  let aiQuotaRateKey: string | null = null;

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

    const effectiveLimit = linkedMember?.isProActive
      ? settings.daily_pro_ai_limit
      : settings.daily_ai_limit_per_user;

    const rateKey = `wa:${waId}`;
    const quota = await consumeAiQuota(rateKey, effectiveLimit);
    if (!quota.allowed) {
      const upsellMsg = linkedMember?.isProActive
        ? `⏳ Kuota harian AI Vision Pro kamu sudah habis (${quota.limit}x/hari). Reset otomatis pukul 00:00 WIB.`
        : `⏳ Kuota harian AI Vision gratis kamu sudah habis (${quota.limit}x/hari).\n\n👑 Mau kuota *${settings.daily_pro_ai_limit}x/hari* & ganti nama pack stiker pakai namamu sendiri? Upgrade ke *PRO CREATOR* di:\n${APP_URL}/register?plan=pro`;

      await sock.sendMessage(
        remoteJid,
        { text: upsellMsg },
        { quoted: originalMsg }
      );
      return;
    }

    aiQuotaRateKey = rateKey;
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
        exif,
      });
    } else if (lower === "/news" || lower.startsWith("/news ")) {
      commandType = "breaking_news";
      const headline = caption.slice(5).trim() || "BERITA TERKINI HARI INI";
      loggedCaption = headline.slice(0, 200);
      result = await createBreakingNewsSticker(mediaBuffer, { headline, exif });
    } else if (lower === "/crop" || lower.startsWith("/crop ")) {
      commandType = "crop";
      result = await processImageToSticker(mediaBuffer, { mode: "cover", exif });
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
        exif,
      });
    } else {
      commandType = "standard";
      result = await processImageToSticker(mediaBuffer, {
        mode: "contain",
        exif,
      });
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
      user_id: linkedMember?.userId ?? null,
      wa_message_id: messageId,
      source: "whatsapp",
      command_type: commandType,
      caption_text: loggedCaption,
      status: "success",
      processing_time_ms: totalProcessMs,
      file_size_kb: result.sizeKb,
    });
    console.log(
      `✅ [WA-BOT ${commandType}] Terkirim (${result.sizeKb} KB, ${totalProcessMs} ms)${
        linkedMember?.isProActive ? " [PRO]" : ""
      }`
    );
  } catch (err) {
    const errMsg = err instanceof Error ? err.message : "Unknown error";
    console.error(`[WA-BOT Image - ${commandType}] Error:`, errMsg);

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
