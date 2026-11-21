"use client";

import { useState } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import {
  Sparkles,
  BarChart3,
  Wand2,
  Lock,
  LogOut,
  ShieldCheck,
  Loader2,
} from "lucide-react";
import type { AdminSession } from "@/lib/auth";

interface NavbarProps {
  admin?: AdminSession | null;
}

export default function Navbar({ admin = null }: NavbarProps) {
  const pathname = usePathname();
  const router = useRouter();
  const [isLoggingOut, setIsLoggingOut] = useState(false);

  async function handleLogout() {
    setIsLoggingOut(true);
    try {
      await fetch("/api/admin/auth/logout", { method: "POST" });
      router.push("/");
      router.refresh();
    } catch (err) {
      console.error("[Navbar] Logout error:", err);
    } finally {
      setIsLoggingOut(false);
    }
  }

  return (
    <header className="sticky top-0 z-40 border-b border-slate-200 bg-white/85 backdrop-blur-md">
      <div className="mx-auto flex h-16 max-w-6xl items-center justify-between gap-3 px-4 sm:px-6">
        <Link href="/" className="flex items-center gap-2.5">
          <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-emerald-600 text-white shadow-sm">
            <Sparkles className="h-5 w-5" />
          </div>
          <div className="leading-tight">
            <span className="block text-sm font-bold tracking-tight text-slate-900 sm:text-base">
              WA AI Sticker Studio
            </span>
            <span className="hidden text-xs text-slate-500 sm:block">
              WhatsApp Cloud API + Gemini Vision
            </span>
          </div>
        </Link>

        <nav className="flex items-center gap-1.5 sm:gap-2">
          <Link
            href="/"
            className={`flex items-center gap-1.5 rounded-lg px-3 py-2 text-xs font-medium transition-colors sm:text-sm ${
              pathname === "/"
                ? "bg-slate-900 text-white shadow-sm"
                : "text-slate-600 hover:bg-slate-100 hover:text-slate-900"
            }`}
          >
            <Wand2 className="h-4 w-4" />
            <span>Sticker Studio</span>
          </Link>

          {admin ? (
            <>
              <Link
                href="/dashboard"
                className={`flex items-center gap-1.5 rounded-lg px-3 py-2 text-xs font-medium transition-colors sm:text-sm ${
                  pathname.startsWith("/dashboard")
                    ? "bg-slate-900 text-white shadow-sm"
                    : "text-slate-600 hover:bg-slate-100 hover:text-slate-900"
                }`}
              >
                <BarChart3 className="h-4 w-4" />
                <span>Dashboard</span>
              </Link>

              <div className="hidden items-center gap-1.5 rounded-lg border border-emerald-200 bg-emerald-50 px-2.5 py-1.5 text-[11px] font-bold tracking-wide text-emerald-800 uppercase md:inline-flex">
                <ShieldCheck className="h-3.5 w-3.5 text-emerald-600" />
                <span>{admin.role}</span>
              </div>

              <button
                type="button"
                onClick={handleLogout}
                disabled={isLoggingOut}
                title={`Logout (${admin.email})`}
                className="flex items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-3 py-2 text-xs font-semibold text-slate-700 transition-colors hover:border-red-200 hover:bg-red-50 hover:text-red-700 disabled:opacity-60 sm:text-sm"
              >
                {isLoggingOut ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <LogOut className="h-4 w-4" />
                )}
                <span className="hidden sm:inline">Keluar</span>
              </button>
            </>
          ) : (
            <Link
              href="/admin/login"
              className={`flex items-center gap-1.5 rounded-lg border px-3 py-2 text-xs font-semibold transition-colors sm:text-sm ${
                pathname === "/admin/login"
                  ? "border-slate-900 bg-slate-900 text-white"
                  : "border-slate-200 bg-white text-slate-600 hover:bg-slate-100 hover:text-slate-900"
              }`}
            >
              <Lock className="h-3.5 w-3.5" />
              <span>Admin</span>
            </Link>
          )}
        </nav>
      </div>
    </header>
  );
}