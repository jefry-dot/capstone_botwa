"use client";

import { Suspense, useState, type FormEvent } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import {
  User,
  Mail,
  Lock,
  Eye,
  EyeOff,
  Loader2,
  AlertCircle,
  ArrowRight,
  Crown,
} from "lucide-react";

function RegisterForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const wantsPro = searchParams.get("plan") === "pro";

  const [fullName, setFullName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);

    if (fullName.trim().length < 2) {
      setError("Masukkan nama lengkap minimal 2 karakter.");
      return;
    }
    if (!email.trim()) {
      setError("Email wajib diisi.");
      return;
    }
    if (password.length < 6) {
      setError("Password minimal 6 karakter.");
      return;
    }

    setIsSubmitting(true);

    try {
      const res = await fetch("/api/auth/register", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          fullName: fullName.trim(),
          email: email.trim(),
          password,
        }),
      });

      const data = (await res.json().catch(() => ({}))) as { error?: string };
      if (!res.ok) {
        throw new Error(data.error || `Registrasi gagal (${res.status}).`);
      }

      router.push(wantsPro ? "/account?upgrade=1" : "/account");
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Gagal mendaftar akun.");
      setIsSubmitting(false);
    }
  }

  return (
    <div className="mx-auto flex max-w-md flex-col justify-center py-6 sm:py-10">
      <div className="zine-card p-6 sm:p-8">
        <div className="mb-6 border-b-2 border-[#161614] pb-5 text-center">
          <div className="mx-auto mb-3 flex h-12 w-12 items-center justify-center border-2 border-[#161614] bg-[#B9F32B] text-[#161614] shadow-[3px_3px_0_#161614]">
            <Crown className="h-6 w-6" />
          </div>
          <p className="font-mono text-[10px] font-bold uppercase tracking-widest text-[#5C584F]">
            {wantsPro
              ? "LANGKAH 1/2 // DAFTAR UNTUK PRO CREATOR"
              : "AKUN PENGGUNA // LANGSUNG AKTIF"}
          </p>
          <h1 className="mt-1 font-display text-2xl font-bold tracking-tight text-[#161614]">
            Buat Akun AmbaBot
          </h1>
          <p className="mt-1.5 text-xs leading-relaxed text-[#45433D]">
            Tanpa konfirmasi email—langsung masuk ke Dashboard Akun untuk
            tautkan WhatsApp (<code className="font-mono font-bold">/link</code>
            ) dan aktifkan fitur Pro.
          </p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label
              htmlFor="reg-name"
              className="mb-1.5 block font-mono text-xs font-bold uppercase text-[#161614]"
            >
              Nama Lengkap
            </label>
            <div className="relative">
              <User className="pointer-events-none absolute top-1/2 left-3.5 h-4 w-4 -translate-y-1/2 text-[#5C584F]" />
              <input
                id="reg-name"
                type="text"
                required
                maxLength={60}
                value={fullName}
                onChange={(e) => setFullName(e.target.value)}
                placeholder="Contoh: Budi Santoso"
                className="w-full border-2 border-[#161614] bg-[#FFFDF7] py-2.5 pr-3.5 pl-10 text-sm text-[#161614] focus:bg-[#FFFBEB] focus:outline-none"
              />
            </div>
          </div>

          <div>
            <label
              htmlFor="reg-email"
              className="mb-1.5 block font-mono text-xs font-bold uppercase text-[#161614]"
            >
              Email
            </label>
            <div className="relative">
              <Mail className="pointer-events-none absolute top-1/2 left-3.5 h-4 w-4 -translate-y-1/2 text-[#5C584F]" />
              <input
                id="reg-email"
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
              htmlFor="reg-password"
              className="mb-1.5 block font-mono text-xs font-bold uppercase text-[#161614]"
            >
              Password (Min. 6 Karakter)
            </label>
            <div className="relative">
              <Lock className="pointer-events-none absolute top-1/2 left-3.5 h-4 w-4 -translate-y-1/2 text-[#5C584F]" />
              <input
                id="reg-password"
                type={showPassword ? "text" : "password"}
                autoComplete="new-password"
                required
                minLength={6}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="Buat password akun"
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
            className="zine-btn flex w-full cursor-pointer items-center justify-center gap-2 bg-[#B9F32B] px-4 py-3 font-display text-sm font-bold text-[#161614] disabled:cursor-not-allowed disabled:opacity-60"
          >
            {isSubmitting ? (
              <>
                <Loader2 className="h-4 w-4 animate-spin" />
                <span>Membuat akun...</span>
              </>
            ) : (
              <>
                <span>Daftar &amp; Masuk Dashboard</span>
                <ArrowRight className="h-4 w-4" />
              </>
            )}
          </button>
        </form>

        <div className="mt-6 border-t-2 border-dashed border-[#161614]/25 pt-4 text-center text-xs text-[#45433D]">
          <span>Sudah punya akun? </span>
          <Link
            href="/login"
            className="font-mono font-bold uppercase text-[#161614] underline"
          >
            Masuk di sini
          </Link>
        </div>
      </div>
    </div>
  );
}

export default function RegisterPage() {
  return (
    <Suspense
      fallback={
        <div className="mx-auto flex max-w-md justify-center py-16">
          <Loader2 className="h-7 w-7 animate-spin text-[#161614]" />
        </div>
      }
    >
      <RegisterForm />
    </Suspense>
  );
}
