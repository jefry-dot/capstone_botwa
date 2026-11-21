import sharp from "sharp";

export type AiMemeMode = "aimeme" | "roast";

export interface AiMemeCaption {
  topText: string;
  bottomText: string;
}

const GEMINI_MODEL = "gemini-2.5-flash";

interface GeminiApiResponse {
  candidates?: Array<{
    content?: {
      parts?: Array<{
        text?: string;
      }>;
    };
  }>;
  error?: {
    message?: string;
  };
}

export async function generateAiMemeCaption(
  imageBuffer: Buffer,
  mode: AiMemeMode = "aimeme"
): Promise<AiMemeCaption> {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    throw new Error("Missing GEMINI_API_KEY environment variable.");
  }

  // Perkecil gambar sebelum dikirim ke Vision API agar latency rendah & hemat payload
  const compressedJpeg = await sharp(imageBuffer)
    .rotate()
    .resize(512, 512, { fit: "inside", withoutEnlargement: true })
    .jpeg({ quality: 75 })
    .toBuffer();

  const base64Image = compressedJpeg.toString("base64");

  const instruction =
    mode === "roast"
      ? [
          "Analisis foto ini (ekspresi, pose, objek, atau suasananya).",
          "Buat caption meme gaya ROAST / sindiran sarkas lucu yang santai dan tetap sopan (tidak SARA, tidak kasar berlebihan) dalam bahasa Indonesia gaul anak kampus.",
          "Balas HANYA JSON dengan format { \"topText\": \"...\", \"bottomText\": \"...\" }.",
          "Setiap baris maksimal 5-6 kata, singkat, ngena, dan langsung lucu.",
        ].join(" ")
      : [
          "Analisis foto ini (ekspresi wajah, objek, atau situasi yang terlihat).",
          "Buat caption meme komedi situasi (relatable untuk kehidupan sehari-hari atau mahasiswa) dalam bahasa Indonesia gaul yang lucu.",
          "Balas HANYA JSON dengan format { \"topText\": \"...\", \"bottomText\": \"...\" }.",
          "Setiap baris maksimal 5-6 kata, singkat, punchy, dan cocok jadi stiker WhatsApp.",
        ].join(" ");

  const endpoint = `https://generativelanguage.googleapis.com/v1beta/models/${GEMINI_MODEL}:generateContent?key=${encodeURIComponent(apiKey)}`;

  const response = await fetch(endpoint, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      contents: [
        {
          parts: [
            { text: instruction },
            {
              inline_data: {
                mime_type: "image/jpeg",
                data: base64Image,
              },
            },
          ],
        },
      ],
      generationConfig: {
        temperature: 0.9,
        responseMimeType: "application/json",
        responseSchema: {
          type: "OBJECT",
          properties: {
            topText: { type: "STRING" },
            bottomText: { type: "STRING" },
          },
          required: ["topText", "bottomText"],
        },
      },
    }),
  });

  if (!response.ok) {
    const errText = await response.text();
    throw new Error(`Gemini API failed (${response.status}): ${errText}`);
  }

  const data = (await response.json()) as GeminiApiResponse;
  const rawText = data.candidates?.[0]?.content?.parts?.[0]?.text;

  if (!rawText) {
    throw new Error("Gemini API returned an empty response.");
  }

  try {
    const parsed = JSON.parse(rawText) as Partial<AiMemeCaption>;
    const topText = (parsed.topText ?? "").trim();
    const bottomText = (parsed.bottomText ?? "").trim();

    if (!topText && !bottomText) {
      throw new Error("Empty caption fields.");
    }

    return { topText, bottomText };
  } catch {
    throw new Error(`Failed to parse Gemini JSON output: ${rawText}`);
  }
}