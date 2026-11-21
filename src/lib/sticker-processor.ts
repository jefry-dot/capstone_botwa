import sharp from "sharp";

export interface StickerOptions {
  topText?: string;
  bottomText?: string;
  mode?: "contain" | "cover";
}

export interface QuoteBubbleOptions {
  name: string;
  text: string;
  time?: string;
}

export interface BratStickerOptions {
  text: string;
}

export interface BreakingNewsOptions {
  headline: string;
  time?: string;
}

export interface StickerResult {
  buffer: Buffer;
  sizeKb: number;
  processingTimeMs: number;
}

const MAX_STICKER_BYTES = 98 * 1024; // Margin aman di bawah batas 100KB WhatsApp
const QUALITY_STEPS = [82, 68, 55, 40, 28, 18];

const AVATAR_COLORS = [
  "#E17076",
  "#7BC862",
  "#E5A93C",
  "#65AADD",
  "#A695E7",
  "#EE7AAE",
  "#6EC9CB",
  "#FAA774",
];

function escapeXml(text: string): string {
  return text
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&apos;");
}

function getWibTimeString(): string {
  const formatted = new Intl.DateTimeFormat("id-ID", {
    timeZone: "Asia/Jakarta",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  }).format(new Date());
  return formatted.replace(".", ":");
}

function wrapText(
  text: string,
  maxCharsPerLine: number,
  maxLines: number,
  uppercase = false
): string[] {
  const cleaned = (uppercase ? text.toUpperCase() : text).trim();
  if (!cleaned) return [];

  const words = cleaned.split(/\s+/);
  const lines: string[] = [];
  let current = "";

  for (const rawWord of words) {
    // Pecah kata yang terlalu panjang agar tidak keluar kanvas
    const word =
      rawWord.length > maxCharsPerLine
        ? rawWord.slice(0, maxCharsPerLine - 1) + "-"
        : rawWord;

    if (!current) {
      current = word;
    } else if ((current + " " + word).length <= maxCharsPerLine) {
      current += " " + word;
    } else {
      lines.push(current);
      current = word;
      if (lines.length >= maxLines) break;
    }
  }

  if (current && lines.length < maxLines) {
    lines.push(current);
  }

  return lines.slice(0, maxLines);
}

function pickColorFromName(name: string): string {
  let hash = 0;
  for (let i = 0; i < name.length; i++) {
    hash = name.charCodeAt(i) + ((hash << 5) - hash);
  }
  return AVATAR_COLORS[Math.abs(hash) % AVATAR_COLORS.length];
}

function getInitials(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return "U";
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return (parts[0][0] + parts[1][0]).toUpperCase();
}

async function encodeWebpUnderLimit(
  preparedPng: Buffer,
  startTime: number
): Promise<StickerResult> {
  let finalBuffer: Buffer | null = null;

  for (const quality of QUALITY_STEPS) {
    const candidate = await sharp(preparedPng)
      .webp({ quality, effort: 4 })
      .toBuffer();

    finalBuffer = candidate;
    if (candidate.byteLength <= MAX_STICKER_BYTES) {
      break;
    }
  }

  if (!finalBuffer) {
    throw new Error("Failed to encode WebP sticker.");
  }

  return {
    buffer: finalBuffer,
    sizeKb: Number((finalBuffer.byteLength / 1024).toFixed(2)),
    processingTimeMs: Date.now() - startTime,
  };
}

// ============================================================================
// MODE 1, 2, 3: Standard, Smart Crop, Classic Meme & AI Meme
// ============================================================================
function buildMemeSvg(topText?: string, bottomText?: string): Buffer {
  const topLines = topText ? wrapText(topText, 16, 3, true) : [];
  const bottomLines = bottomText ? wrapText(bottomText, 16, 3, true) : [];

  const fontSize = 42;
  const lineHeight = 46;

  const topSvg = topLines
    .map((line, idx) => {
      const y = 56 + idx * lineHeight;
      return `<text x="256" y="${y}" text-anchor="middle" class="meme">${escapeXml(line)}</text>`;
    })
    .join("\n");

  const bottomStartY = 486 - (bottomLines.length - 1) * lineHeight;
  const bottomSvg = bottomLines
    .map((line, idx) => {
      const y = bottomStartY + idx * lineHeight;
      return `<text x="256" y="${y}" text-anchor="middle" class="meme">${escapeXml(line)}</text>`;
    })
    .join("\n");

  const svg = `
    <svg width="512" height="512" viewBox="0 0 512 512" xmlns="http://www.w3.org/2000/svg">
      <style>
        .meme {
          font-family: Impact, "Arial Black", "DejaVu Sans", sans-serif;
          font-size: ${fontSize}px;
          font-weight: 900;
          fill: #FFFFFF;
          stroke: #000000;
          stroke-width: 7px;
          stroke-linejoin: round;
          paint-order: stroke;
        }
      </style>
      ${topSvg}
      ${bottomSvg}
    </svg>
  `;

  return Buffer.from(svg);
}

export async function processImageToSticker(
  inputBuffer: Buffer,
  options: StickerOptions = {}
): Promise<StickerResult> {
  const startTime = Date.now();
  const mode = options.mode === "cover" ? "cover" : "contain";

  const basePipeline = sharp(inputBuffer)
    .rotate()
    .resize(512, 512, {
      fit: mode,
      background: { r: 0, g: 0, b: 0, alpha: 0 },
    });

  const hasText = Boolean(options.topText?.trim() || options.bottomText?.trim());
  const composed = hasText
    ? basePipeline.composite([
        {
          input: buildMemeSvg(options.topText, options.bottomText),
          top: 0,
          left: 0,
        },
      ])
    : basePipeline;

  const preparedPng = await composed.png().toBuffer();
  return encodeWebpUnderLimit(preparedPng, startTime);
}

// ============================================================================
// MODE 4: Fake Chat / Quote Bubble Sticker (/qc)
// ============================================================================
export async function createQuoteBubbleSticker(
  options: QuoteBubbleOptions
): Promise<StickerResult> {
  const startTime = Date.now();

  const senderName = (options.name || "Anonim").trim().slice(0, 24);
  const messageText = options.text.trim();
  if (!messageText) {
    throw new Error("Teks untuk stiker /qc tidak boleh kosong.");
  }

  const timeStr = options.time?.trim() || getWibTimeString();
  const accentColor = pickColorFromName(senderName);
  const initials = getInitials(senderName);

  const lines = wrapText(messageText, 24, 6, false);
  const lineHeight = 32;
  const bubbleX = 104;
  const bubbleWidth = 382;
  const bubbleHeight = Math.min(360, 96 + lines.length * lineHeight);
  const bubbleY = Math.round((512 - bubbleHeight) / 2);

  const avatarCx = 52;
  const avatarCy = bubbleY + 34;

  const textElements = lines
    .map((line, i) => {
      const y = bubbleY + 78 + i * lineHeight;
      return `<text x="${bubbleX + 22}" y="${y}" class="msg">${escapeXml(line)}</text>`;
    })
    .join("\n");

  const timeY = bubbleY + bubbleHeight - 16;
  const checkX = bubbleX + bubbleWidth - 36;
  const checkY = timeY - 12;

  const svg = `
    <svg width="512" height="512" viewBox="0 0 512 512" xmlns="http://www.w3.org/2000/svg">
      <style>
        .avatar-text {
          font-family: Arial, "DejaVu Sans", sans-serif;
          font-size: 24px;
          font-weight: 700;
          fill: #FFFFFF;
        }
        .sender {
          font-family: Arial, "DejaVu Sans", sans-serif;
          font-size: 22px;
          font-weight: 700;
          fill: ${accentColor};
        }
        .msg {
          font-family: Arial, "DejaVu Sans", sans-serif;
          font-size: 24px;
          font-weight: 400;
          fill: #E9EDEF;
        }
        .time {
          font-family: Arial, "DejaVu Sans", sans-serif;
          font-size: 16px;
          fill: #8696A0;
        }
      </style>

      <!-- Avatar lingkaran inisial -->
      <circle cx="${avatarCx}" cy="${avatarCy}" r="32" fill="${accentColor}" />
      <text x="${avatarCx}" y="${avatarCy + 9}" text-anchor="middle" class="avatar-text">${escapeXml(initials)}</text>

      <!-- Ekor bubble chat -->
      <path d="M ${bubbleX + 8} ${bubbleY} L ${bubbleX - 14} ${bubbleY} Q ${bubbleX - 4} ${bubbleY + 14} ${bubbleX} ${bubbleY + 26} Z" fill="#202C33" />

      <!-- Body bubble dark mode -->
      <rect x="${bubbleX}" y="${bubbleY}" width="${bubbleWidth}" height="${bubbleHeight}" rx="18" ry="18" fill="#202C33" />

      <!-- Nama pengirim -->
      <text x="${bubbleX + 22}" y="${bubbleY + 38}" class="sender">${escapeXml(senderName)}</text>

      <!-- Isi pesan -->
      ${textElements}

      <!-- Waktu WIB -->
      <text x="${checkX - 8}" y="${timeY}" text-anchor="end" class="time">${escapeXml(timeStr)}</text>

      <!-- Ikon Centang Dua Biru WA -->
      <g transform="translate(${checkX}, ${checkY})" fill="none" stroke="#53BDEB" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round">
        <path d="M 1 7 L 5 11 L 12 2" />
        <path d="M 7 7 L 11 11 L 18 2" />
      </g>
    </svg>
  `;

  const preparedPng = await sharp(Buffer.from(svg)).png().toBuffer();
  return encodeWebpUnderLimit(preparedPng, startTime);
}

// ============================================================================
// MODE 5A: Viral Brat Typography (/brat)
// ============================================================================
export async function createBratSticker(
  options: BratStickerOptions
): Promise<StickerResult> {
  const startTime = Date.now();
  const rawText = options.text.trim().toLowerCase();

  if (!rawText) {
    throw new Error("Teks untuk stiker /brat tidak boleh kosong.");
  }

  // Sesuaikan ukuran font berdasarkan panjang karakter
  const length = rawText.length;
  let fontSize = 68;
  let maxChars = 11;
  let maxLines = 5;

  if (length > 55) {
    fontSize = 42;
    maxChars = 18;
    maxLines = 8;
  } else if (length > 28) {
    fontSize = 54;
    maxChars = 14;
    maxLines = 6;
  }

  const lines = wrapText(rawText, maxChars, maxLines, false);
  const lineHeight = Math.round(fontSize * 1.15);
  const totalHeight = lines.length * lineHeight;
  const startY = Math.round((512 - totalHeight) / 2 + fontSize * 0.82);

  const textNodes = lines
    .map((line, i) => {
      const y = startY + i * lineHeight;
      return `<text x="256" y="${y}" text-anchor="middle" class="brat">${escapeXml(line)}</text>`;
    })
    .join("\n");

  const svg = `
    <svg width="512" height="512" viewBox="0 0 512 512" xmlns="http://www.w3.org/2000/svg">
      <style>
        .brat {
          font-family: "Arial Narrow", Arial, "Liberation Sans", "DejaVu Sans", sans-serif;
          font-size: ${fontSize}px;
          font-weight: 500;
          letter-spacing: -1.5px;
          fill: #000000;
        }
      </style>
      <rect width="512" height="512" fill="#8ACE00" />
      ${textNodes}
    </svg>
  `;

  // Efek low-fi blur tipis khas cover Brat
  const preparedPng = await sharp(Buffer.from(svg))
    .blur(1.1)
    .png()
    .toBuffer();

  return encodeWebpUnderLimit(preparedPng, startTime);
}

// ============================================================================
// MODE 5B: Live Breaking News Frame (/news)
// ============================================================================
export async function createBreakingNewsSticker(
  inputBuffer: Buffer,
  options: BreakingNewsOptions
): Promise<StickerResult> {
  const startTime = Date.now();
  const headline = (options.headline || "BERITA TERKINI HARI INI").trim();
  const timeStr = `${options.time?.trim() || getWibTimeString()} WIB`;

  const lines = wrapText(headline, 26, 2, true);
  const headlineSvg = lines
    .map((line, idx) => {
      const y = lines.length === 1 ? 454 : 440 + idx * 28;
      return `<text x="22" y="${y}" class="headline">${escapeXml(line)}</text>`;
    })
    .join("\n");

  const overlaySvg = `
    <svg width="512" height="512" viewBox="0 0 512 512" xmlns="http://www.w3.org/2000/svg">
      <style>
        .live-text {
          font-family: Arial, "DejaVu Sans", sans-serif;
          font-size: 18px;
          font-weight: 900;
          fill: #FFFFFF;
          letter-spacing: 1px;
        }
        .badge-title {
          font-family: "Arial Black", Arial, "DejaVu Sans", sans-serif;
          font-size: 19px;
          font-weight: 900;
          fill: #FFFFFF;
          letter-spacing: 0.8px;
        }
        .time-tag {
          font-family: Arial, "DejaVu Sans", sans-serif;
          font-size: 16px;
          font-weight: 700;
          fill: #111827;
        }
        .headline {
          font-family: "Arial Black", Arial, "DejaVu Sans", sans-serif;
          font-size: 23px;
          font-weight: 900;
          fill: #FFFFFF;
        }
        .ticker {
          font-family: Arial, "DejaVu Sans", sans-serif;
          font-size: 13px;
          font-weight: 700;
          fill: #FDE047;
          letter-spacing: 0.5px;
        }
      </style>

      <!-- Badge LIVE pojok kanan atas -->
      <rect x="394" y="18" width="100" height="34" rx="6" fill="#DC2626" />
      <circle cx="414" cy="35" r="6" fill="#FFFFFF" />
      <text x="428" y="41" class="live-text">LIVE</text>

      <!-- Gradient tipis biar banner bawah terbaca jelas -->
      <defs>
        <linearGradient id="bottomFade" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stop-color="#000000" stop-opacity="0" />
          <stop offset="100%" stop-color="#000000" stop-opacity="0.75" />
        </linearGradient>
      </defs>
      <rect x="0" y="310" width="512" height="202" fill="url(#bottomFade)" />

      <!-- Label Merah BREAKING NEWS + Kotak Jam Putih -->
      <rect x="16" y="370" width="218" height="32" fill="#DC2626" />
      <text x="26" y="392" class="badge-title">BREAKING NEWS</text>
      <rect x="234" y="370" width="104" height="32" fill="#F8FAFC" />
      <text x="286" y="392" text-anchor="middle" class="time-tag">${escapeXml(timeStr)}</text>

      <!-- Banner Headline Hitam + Aksen Merah Kiri -->
      <rect x="16" y="402" width="480" height="74" fill="#0F172A" fill-opacity="0.93" />
      <rect x="16" y="402" width="7" height="74" fill="#DC2626" />
      ${headlineSvg}

      <!-- Strip Ticker Bawah -->
      <rect x="16" y="476" width="480" height="22" fill="#1E293B" />
      <text x="24" y="492" class="ticker">LAPORAN LANGSUNG  •  WA AI STICKER STUDIO TV</text>
    </svg>
  `;

  const preparedPng = await sharp(inputBuffer)
    .rotate()
    .resize(512, 512, { fit: "cover" })
    .composite([
      {
        input: Buffer.from(overlaySvg),
        top: 0,
        left: 0,
      },
    ])
    .png()
    .toBuffer();

  return encodeWebpUnderLimit(preparedPng, startTime);
}