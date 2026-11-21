"use client";

import { Suspense, useState, type FormEvent } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import {
  ShieldCheck,
  Mail,
  Lock,
  Eye,
  EyeOff,
  Loader2,
  AlertCircle,
  ArrowLeft,
} from "lucide-react";

function sanitizeRedirectPath(rawNext: string | null): string {
  if (!rawNext) return "/dashboard";
  // Cegah open-redirect ke domain luar
  if (!rawNext.startsWith("/") || rawNext.startsWith("//")) {
    return "/dashboard";
  }
  return rawNext;
}

function getQueryErrorMessage(errorCode: string | null): string | null {
  if (errorCode === "forbidden") {
    return "Hak akses akun tidak mencukupi untuk membuka halaman tersebut.";
  }
  if (errorCode === "config") {
    return "Konfigurasi Supabase Auth belum lengkap di environment server.";
  }
  return null;
}

function AdminLoginForm() {
  const router = useRouter();
  const searchParams = useSearchParams();

  const nextPath = sanitizeRedirectPath(searchParams.get("next"));
  const initialError = getQueryErrorMessage(searchParams.get("error"));

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(initialError);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);

    if (!email.trim() || !password) {
      setError("Masukkan email dan password admin terlebih dahulu.");
      return;
    }

    setIsSubmitting(true);

    try {
      const res = await fetch("/api/admin/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          email: email.trim(),
          password,
        }),
      });

      const data = (await res.json().catch(() => ({}))) as { error?: string };

      if (!res.ok) {
        throw new Error(data.error || `Login gagal (${res.status}).`);
      }

      router.push(nextPath);
      router.refresh();
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "Gagal masuk ke portal admin."
      );
      setIsSubmitting(false);
    }
  }

  return (
    <div className="mx-auto flex max-w-md flex-col justify-center py-8 sm:py-14">
      <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm sm:p-8">
        {/* Header */}
        <div className="mb-6 text-center">
          <div className="mx-auto mb-3 flex h-12 w-12 items-center justify-center rounded-2xl bg-slate-900 text-emerald-400 shadow-xs">
            <ShieldCheck className="h-6 w-6" />
          </div>
          <h1 className="text-xl font-extrabold tracking-tight text-slate-900">
            Admin Portal Login
          </h1>
          <p className="mt-1 text-xs leading-relaxed text-slate-500">
            Masuk untuk mengakses Live Telemetry Dashboard, kontrol fitur bot,
            dan moderasi pengguna WhatsApp.
          </p>
        </div>

        {/* Form Login */}
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label
              htmlFor="admin-email"
              className="mb-1.5 block text-xs font-semibold text-slate-700"
            >
              Email Admin
            </label>
            <div className="relative">
              <Mail className="pointer-events-none absolute top-1/2 left-3.5 h-4 w-4 -translate-y-1/2 text-slate-400" />
              <input
                id="admin-email"
                type="email"
                autoComplete="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="admin@kampus.ac.id"
                className="w-full rounded-xl border border-slate-300 py-2.5 pr-3.5 pl-10 text-sm text-slate-900 focus:border-slate-900 focus:outline-none"
              />
            </div>
          </div>

          <div>
            <label
              htmlFor="admin-password"
              className="mb-1.5 block text-xs font-semibold text-slate-700"
            >
              Password
            </label>
            <div className="relative">
              <Lock className="pointer-events-none absolute top-1/2 left-3.5 h-4 w-4 -translate-y-1/2 text-slate-400" />
              <input
                id="admin-password"
                type={showPassword ? "text" : "password"}
                autoComplete="current-password"
                required
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="Masukkan password"
                className="w-full rounded-xl border border-slate-300 py-2.5 pr-10 pl-10 text-sm text-slate-900 focus:border-slate-900 focus:outline-none"
              />
              <button
                type="button"
                onClick={() => setShowPassword((prev) => !prev)}
                aria-label={
                  showPassword ? "Sembunyikan password" : "Lihat password"
                }
                className="absolute top-1/2 right-3 -translate-y-1/2 text-slate-400 hover:text-slate-600"
              >
                {showPassword ? (
                  <EyeOff className="h-4 w-4" />
                ) : (
                  <Eye className="h-4 w-4" />
                )}
              </button>
            </div>
          </div>

          {error && (
            <div className="flex items-start gap-2 rounded-xl border border-red-200 bg-red-50 p-3 text-xs text-red-700">
              <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />
              <span>{error}</span>
            </div>
          )}

          <button
            type="submit"
            disabled={isSubmitting}
            className="flex w-full items-center justify-center gap-2 rounded-xl bg-slate-900 px-4 py-3 text-sm font-bold text-white shadow-xs transition-colors hover:bg-slate-800 disabled:cursor-not-allowed disabled:opacity-60"
          >
            {isSubmitting ? (
              <>
                <Loader2 className="h-4 w-4 animate-spin" />
                <span>Memverifikasi...</span>
              </>
            ) : (
              <span>Masuk ke Dashboard Admin</span>
            )}
          </button>
        </form>

        {/* Footer Info */}
        <div className="mt-6 border-t border-slate-100 pt-4 text-center">
          <p className="text-[11px] text-slate-500">
            Pengguna biasa tidak perlu login untuk membuat stiker.
          </p>
          <Link
            href="/"
            className="mt-2.5 inline-flex items-center gap-1.5 text-xs font-semibold text-emerald-700 hover:text-emerald-800"
          >
            <ArrowLeft className="h-3.5 w-3.5" />
            <span>Kembali ke Web Sticker Studio</span>
          </Link>
        </div>
      </div>
    </div>
  );
}

export default function AdminLoginPage() {
  return (
    <Suspense
      fallback={
        <div className="mx-auto flex max-w-md justify-center py-16">
          <Loader2 className="h-7 w-7 animate-spin text-slate-400" />
        </div>
      }
    >
      <AdminLoginForm />
    </Suspense>
  );
}