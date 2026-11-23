"use client";

import { Suspense, useState, type FormEvent } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import {
  Mail,
  Lock,
  Eye,
  EyeOff,
  Loader2,
  AlertCircle,
  User,
  ArrowRight,
} from "lucide-react";

function sanitizeNext(raw: string | null): string {
  if (!raw || !raw.startsWith("/") || raw.startsWith("//")) return "/account";
  return raw;
}

function UserLoginForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const nextPath = sanitizeNext(searchParams.get("next"));

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);

    if (!email.trim() || !password) {
      setError("Masukkan email dan password kamu terlebih dahulu.");
      return;
    }

    setIsSubmitting(true);

    try {
      const res = await fetch("/api/auth/login", {
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
      setError(err instanceof Error ? err.message : "Gagal masuk ke akun.");
      setIsSubmitting(false);
    }
  }

  return (
    <div className="mx-auto flex max-w-md flex-col justify-center py-6 sm:py-12">
      <div className="zine-card p-6 sm:p-8">
        <div className="mb-6 border-b-2 border-[#161614] pb-5 text-center">
          <div className="mx-auto mb-3 flex h-12 w-12 items-center justify-center border-2 border-[#161614] bg-[#FFD646] text-[#161614] shadow-[3px_3px_0_#161614]">
            <User className="h-6 w-6" />
          </div>
          <p className="font-mono text-[10px] font-bold uppercase tracking-widest text-[#5C584F]">
            USER PORTAL // AMBABOT STUDIO
          </p>
          <h1 className="mt-1 font-display text-2xl font-bold tracking-tight text-[#161614]">
            Masuk ke Akun Kamu
          </h1>
          <p className="mt-1.5 text-xs leading-relaxed text-[#45433D]">
            Kelola paket Pro, tautan WhatsApp, Custom Nama Pack EXIF, dan
            riwayat stiker WA milikmu.
          </p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label
              htmlFor="user-email"
              className="mb-1.5 block font-mono text-xs font-bold uppercase text-[#161614]"
            >
              Email
            </label>
            <div className="relative">
              <Mail className="pointer-events-none absolute top-1/2 left-3.5 h-4 w-4 -translate-y-1/2 text-[#5C584F]" />
              <input
                id="user-email"
                type="email"
                autoComplete="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="budi@gmail.com"
                className="w-full border-2 border-[#161614] bg-[#FFFDF7] py-2.5 pr-3.5 pl-10 text-sm text-[#161614] focus:bg-[#FFFBEB] focus:outline-none"
              />
            </div>
          </div>

          <div>
            <label
              htmlFor="user-password"
              className="mb-1.5 block font-mono text-xs font-bold uppercase text-[#161614]"
            >
              Password
            </label>
            <div className="relative">
              <Lock className="pointer-events-none absolute top-1/2 left-3.5 h-4 w-4 -translate-y-1/2 text-[#5C584F]" />
              <input
                id="user-password"
                type={showPassword ? "text" : "password"}
                autoComplete="current-password"
                required
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="Masukkan password"
                className="w-full border-2 border-[#161614] bg-[#FFFDF7] py-2.5 pr-10 pl-10 text-sm text-[#161614] focus:bg-[#FFFBEB] focus:outline-none"
              />
              <button
                type="button"
                onClick={() => setShowPassword((prev) => !prev)}
                aria-label={
                  showPassword ? "Sembunyikan password" : "Lihat password"
                }
                className="absolute top-1/2 right-3 -translate-y-1/2 text-[#5C584F] hover:text-[#161614]"
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
            <div className="flex items-start gap-2 border-2 border-[#161614] bg-[#EB3B2E] p-3 text-xs font-medium text-white shadow-[2px_2px_0_#161614]">
              <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />
              <span>{error}</span>
            </div>
          )}

          <button
            type="submit"
            disabled={isSubmitting}
            className="zine-btn flex w-full cursor-pointer items-center justify-center gap-2 bg-[#161614] px-4 py-3 font-display text-sm font-bold text-[#F5F0E6] disabled:cursor-not-allowed disabled:opacity-60"
          >
            {isSubmitting ? (
              <>
                <Loader2 className="h-4 w-4 animate-spin" />
                <span>Memeriksa akun...</span>
              </>
            ) : (
              <>
                <span>Masuk ke Akun Saya</span>
                <ArrowRight className="h-4 w-4" />
              </>
            )}
          </button>
        </form>

        <div className="mt-6 border-t-2 border-dashed border-[#161614]/25 pt-4 text-center text-xs text-[#45433D]">
          <span>Belum punya akun? </span>
          <Link
            href="/register"
            className="font-mono font-bold uppercase text-[#161614] underline"
          >
            Daftar Gratis (5 Detik)
          </Link>
        </div>
      </div>
    </div>
  );
}

export default function UserLoginPage() {
  return (
    <Suspense
      fallback={
        <div className="mx-auto flex max-w-md justify-center py-16">
          <Loader2 className="h-7 w-7 animate-spin text-[#161614]" />
        </div>
      }
    >
      <UserLoginForm />
    </Suspense>
  );
}
