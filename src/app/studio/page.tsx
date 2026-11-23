import { redirect } from "next/navigation";

/**
 * Seluruh pembuatan stiker kini difokuskan 100% melalui Bot WhatsApp.
 * Route /studio diarahkan otomatis ke panduan cara pakai Bot WA di halaman utama.
 */
export default function StudioRedirectPage() {
  redirect("/#cara-pakai");
}
