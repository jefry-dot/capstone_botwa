import { NextRequest, NextResponse } from "next/server";
import { requireUserApi } from "@/lib/user-auth";
import { getSupabaseAdmin } from "@/lib/supabase";

export const runtime = "nodejs";

interface BrandingBody {
  customPackName?: unknown;
  customPackAuthor?: unknown;
}

export async function PATCH(request: NextRequest) {
  const auth = await requireUserApi();
  if (!auth.ok) return auth.response;

  const { user } = auth;

  if (!user.isProActive) {
    return NextResponse.json(
      {
        error:
          "Fitur Custom Pack EXIF hanya tersedia untuk pengguna PRO CREATOR. Silakan upgrade terlebih dahulu.",
      },
      { status: 403 }
    );
  }

  try {
    const body = (await request.json().catch(() => null)) as BrandingBody | null;
    const packName =
      typeof body?.customPackName === "string"
        ? body.customPackName.trim()
        : "";
    const packAuthor =
      typeof body?.customPackAuthor === "string"
        ? body.customPackAuthor.trim()
        : "";

    if (packName.length > 32 || packAuthor.length > 32) {
      return NextResponse.json(
        { error: "Nama Pack dan Author masing-masing maksimal 32 karakter." },
        { status: 400 }
      );
    }

    const adminDb = getSupabaseAdmin();
    const { error } = await adminDb
      .from("user_profiles")
      .update({
        custom_pack_name: packName || null,
        custom_pack_author: packAuthor || null,
        updated_at: new Date().toISOString(),
      })
      .eq("id", user.id);

    if (error) {
      throw new Error(error.message);
    }

    return NextResponse.json(
      {
        ok: true,
        customPackName: packName || null,
        customPackAuthor: packAuthor || null,
      },
      { status: 200 }
    );
  } catch (err) {
    const errMsg =
      err instanceof Error ? err.message : "Gagal menyimpan branding stiker.";
    console.error("[API /api/user/branding] Error:", errMsg);
    return NextResponse.json({ error: errMsg }, { status: 500 });
  }
}
