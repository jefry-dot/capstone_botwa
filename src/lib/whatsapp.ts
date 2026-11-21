const GRAPH_API_VERSION = "v21.0";
const GRAPH_BASE_URL = `https://graph.facebook.com/${GRAPH_API_VERSION}`;

function getWhatsAppConfig() {
  const token = process.env.WHATSAPP_TOKEN;
  const phoneNumberId = process.env.WHATSAPP_PHONE_NUMBER_ID;

  if (!token || !phoneNumberId) {
    throw new Error(
      "Missing WHATSAPP_TOKEN or WHATSAPP_PHONE_NUMBER_ID environment variables."
    );
  }

  return { token, phoneNumberId };
}

export async function downloadWhatsAppMedia(mediaId: string): Promise<Buffer> {
  const { token } = getWhatsAppConfig();

  // Step 1: Ambil temporary download URL dari Meta
  const metaRes = await fetch(`${GRAPH_BASE_URL}/${mediaId}`, {
    headers: { Authorization: `Bearer ${token}` },
  });

  if (!metaRes.ok) {
    const errText = await metaRes.text();
    throw new Error(`Meta media lookup failed (${metaRes.status}): ${errText}`);
  }

  const metaJson = (await metaRes.json()) as { url?: string };
  if (!metaJson.url) {
    throw new Error("Meta media response did not contain a download URL.");
  }

  // Step 2: Download binary gambarnya
  const fileRes = await fetch(metaJson.url, {
    headers: { Authorization: `Bearer ${token}` },
  });

  if (!fileRes.ok) {
    throw new Error(`Meta media download failed (${fileRes.status})`);
  }

  const arrayBuffer = await fileRes.arrayBuffer();
  return Buffer.from(arrayBuffer);
}

export async function uploadStickerMedia(webpBuffer: Buffer): Promise<string> {
  const { token, phoneNumberId } = getWhatsAppConfig();

  const formData = new FormData();
  formData.append("messaging_product", "whatsapp");
  formData.append(
    "file",
    new Blob([new Uint8Array(webpBuffer)], { type: "image/webp" }),
    "sticker.webp"
  );

  const res = await fetch(`${GRAPH_BASE_URL}/${phoneNumberId}/media`, {
    method: "POST",
    headers: { Authorization: `Bearer ${token}` },
    body: formData,
  });

  if (!res.ok) {
    const errText = await res.text();
    throw new Error(`Meta media upload failed (${res.status}): ${errText}`);
  }

  const data = (await res.json()) as { id?: string };
  if (!data.id) {
    throw new Error("Meta upload succeeded but returned no media ID.");
  }

  return data.id;
}

export async function sendStickerMessage(
  to: string,
  mediaId: string
): Promise<void> {
  const { token, phoneNumberId } = getWhatsAppConfig();

  const res = await fetch(`${GRAPH_BASE_URL}/${phoneNumberId}/messages`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      messaging_product: "whatsapp",
      recipient_type: "individual",
      to,
      type: "sticker",
      sticker: { id: mediaId },
    }),
  });

  if (!res.ok) {
    const errText = await res.text();
    throw new Error(`Send sticker failed (${res.status}): ${errText}`);
  }
}

export async function sendTextMessage(to: string, body: string): Promise<void> {
  const { token, phoneNumberId } = getWhatsAppConfig();

  const res = await fetch(`${GRAPH_BASE_URL}/${phoneNumberId}/messages`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      messaging_product: "whatsapp",
      recipient_type: "individual",
      to,
      type: "text",
      text: { body },
    }),
  });

  if (!res.ok) {
    const errText = await res.text();
    throw new Error(`Send text failed (${res.status}): ${errText}`);
  }
}