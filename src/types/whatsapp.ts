export interface WhatsAppContact {
  wa_id: string;
  profile?: {
    name?: string;
  };
}

export interface WhatsAppTextObject {
  body?: string;
}

export interface WhatsAppImageObject {
  id?: string;
  mime_type?: string;
  sha256?: string;
  caption?: string;
}

export interface WhatsAppIncomingMessage {
  id: string;
  from: string;
  timestamp: string;
  type: "text" | "image" | "sticker" | "video" | "audio" | "document" | string;
  text?: WhatsAppTextObject;
  image?: WhatsAppImageObject;
}

export interface WhatsAppChangeValue {
  messaging_product?: string;
  metadata?: {
    display_phone_number?: string;
    phone_number_id?: string;
  };
  contacts?: WhatsAppContact[];
  messages?: WhatsAppIncomingMessage[];
  statuses?: Array<Record<string, unknown>>;
}

export interface WhatsAppWebhookEntry {
  id?: string;
  changes?: Array<{
    field?: string;
    value?: WhatsAppChangeValue;
  }>;
}

export interface WhatsAppWebhookPayload {
  object?: string;
  entry?: WhatsAppWebhookEntry[];
}
