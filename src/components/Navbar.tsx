"use client";

import { useState } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import {
  BarChart3,
  LogOut,
  ShieldCheck,
  Loader2,
  ArrowUpRight,
  MessageCircle,
  Crown,
  User,
} from "lucide-react";
import type { AdminSession } from "@/lib/auth";
import type { CurrentUserSession } from "@/lib/user-auth";

const WA_BOT_NUMBER =
  process.env.NEXT_PUBLIC_WA_BOT_NUMBER || "6285959632681";
const WA_BOT_LINK = `https://wa.me/${WA_BOT_NUMBER}?text=${encodeURIComponent(
  "/help"
)}`;

interface NavbarProps {
  admin?: AdminSession | null;
  user?: CurrentUserSession | null;
}

export default function Navbar({ admin = null, user = null }: NavbarProps) {
  const pathname = usePathname();
  const router = useRouter();
  const [isLoggingOut, setIsLoggingOut] = useState(false);

  async function handleLogout(isAdminLogout: boolean) {
    setIsLoggingOut(true);
    try {
      await fetch(
        isAdminLogout ? "/api/admin/auth/logout" : "/api/auth/logout",
        { method: "POST" }
      );
      router.push("/");
      router.refresh();
    } catch (err) {
      console.error("[Navbar] Logout error:", err);
    } finally {
      setIsLoggingOut(false);
    }
  }

  return (
    <header className="sticky top-0 z-40 border-b-2 border-[#161614] bg-[#F5F0E6]/95 backdrop-blur-sm">
      <div className="mx-auto flex h-16 max-w-6xl items-center justify-between gap-2 px-4 sm:px-6">
        {/* Brand Stamp */}
        <Link href="/" className="group flex items-center gap-2.5">
          <div className="flex h-9 w-9 items-center justify-center border-2 border-[#161614] bg-[#B9F32B] font-display text-sm font-bold text-[#161614] shadow-[2px_2px_0_#161614] transition-transform group-hover:-rotate-3">
            AB
          </div>
          <div className="leading-none">
            <span className="block font-display text-base font-bold tracking-tight text-[#161614]">
              AMBABOT
            </span>
            <span className="mt-0.5 hidden font-mono text-[10px] font-medium uppercase tracking-wider text-[#5C584F] sm:block">
              WA Sticker Press
            </span>
          </div>
        </Link>

        {/* Navigation Links */}
        <nav className="flex items-center gap-1.5 sm:gap-2">
          <Link
            href="/"
            className={`hidden px-2.5 py-1.5 font-mono text-xs font-bold uppercase tracking-wide transition-colors md:inline-block ${
              pathname === "/"
                ? "border-2 border-[#161614] bg-[#FFD646] text-[#161614]"
                : "border-2 border-transparent text-[#3B3934] hover:border-[#161614] hover:bg-[#FFFDF7]"
            }`}
          >
            Profil
          </Link>

          <Link
            href="/#harga"
            className="hidden border-2 border-transparent px-2.5 py-1.5 font-mono text-xs font-bold uppercase tracking-wide text-[#3B3934] transition-colors hover:border-[#161614] hover:bg-[#FFFDF7] md:inline-block"
          >
            Harga
          </Link>

          <a
            href={WA_BOT_LINK}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-1 border-2 border-[#161614] bg-[#B9F32B] px-2.5 py-1.5 font-mono text-xs font-bold uppercase tracking-wide text-[#161614] shadow-[2px_2px_0_#161614] transition-transform hover:-translate-y-0.5 sm:px-3"
          >
            <MessageCircle className="h-3.5 w-3.5" />
            <span>Bot WA</span>
            <ArrowUpRight className="hidden h-3.5 w-3.5 sm:inline" />
          </a>

          {admin ? (
            <>
              <Link
                href="/dashboard"
                className={`flex items-center gap-1.5 border-2 border-[#161614] px-3 py-1.5 font-mono text-xs font-bold uppercase transition-colors ${
                  pathname.startsWith("/dashboard")
                    ? "bg-[#161614] text-[#F5F0E6]"
                    : "bg-[#FFFDF7] text-[#161614] hover:bg-[#EFE7D8]"
                }`}
              >
                <BarChart3 className="h-3.5 w-3.5" />
                <span className="hidden sm:inline">Dashboard</span>
              </Link>

              <div className="hidden items-center gap-1 border-2 border-[#161614] bg-[#FFD646] px-2 py-1 font-mono text-[10px] font-bold uppercase text-[#161614] lg:inline-flex">
                <ShieldCheck className="h-3 w-3" />
                <span>{admin.role}</span>
              </div>

              <button
                type="button"
                onClick={() => void handleLogout(true)}
                disabled={isLoggingOut}
                title={`Logout (${admin.email})`}
                className="flex cursor-pointer items-center gap-1 border-2 border-[#161614] bg-[#FFFDF7] px-2.5 py-1.5 font-mono text-xs font-bold uppercase text-[#161614] transition-colors hover:bg-[#EB3B2E] hover:text-white disabled:opacity-60"
              >
                {isLoggingOut ? (
                  <Loader2 className="h-3.5 w-3.5 animate-spin" />
                ) : (
                  <LogOut className="h-3.5 w-3.5" />
                )}
                <span className="hidden sm:inline">Keluar</span>
              </button>
            </>
          ) : user ? (
            <>
              <Link
                href="/account"
                className={`inline-flex items-center gap-1.5 border-2 border-[#161614] px-2.5 py-1.5 font-mono text-xs font-bold uppercase transition-colors sm:px-3 ${
                  pathname.startsWith("/account")
                    ? "bg-[#161614] text-[#F5F0E6]"
                    : "bg-[#FFFDF7] text-[#161614] hover:bg-[#FFD646]"
                }`}
              >
                {user.isProActive ? (
                  <Crown className="h-3.5 w-3.5 text-[#FFD646]" />
                ) : (
                  <User className="h-3.5 w-3.5" />
                )}
                <span>Akun</span>
                <span
                  className={`hidden px-1 py-0.2 text-[9px] font-bold sm:inline ${
                    user.isProActive
                      ? "bg-[#B9F32B] text-[#161614]"
                      : "bg-[#EFE7D8] text-[#161614]"
                  }`}
                >
                  {user.isProActive ? "PRO" : "FREE"}
                </span>
              </Link>

              <button
                type="button"
                onClick={() => void handleLogout(false)}
                disabled={isLoggingOut}
                title={`Logout (${user.email})`}
                className="flex cursor-pointer items-center gap-1 border-2 border-[#161614] bg-[#FFFDF7] px-2.5 py-1.5 font-mono text-xs font-bold uppercase text-[#161614] transition-colors hover:bg-[#EB3B2E] hover:text-white disabled:opacity-60"
              >
                {isLoggingOut ? (
                  <Loader2 className="h-3.5 w-3.5 animate-spin" />
                ) : (
                  <LogOut className="h-3.5 w-3.5" />
                )}
                <span className="hidden sm:inline">Keluar</span>
              </button>
            </>
          ) : (
            <>
              <Link
                href="/login"
                className={`border-2 border-[#161614] px-2.5 py-1.5 font-mono text-xs font-bold uppercase transition-colors sm:px-3 ${
                  pathname === "/login"
                    ? "bg-[#161614] text-[#F5F0E6]"
                    : "bg-[#FFFDF7] text-[#161614] hover:bg-[#EFE7D8]"
                }`}
              >
                Masuk
              </Link>
              <Link
                href="/register"
                className={`hidden border-2 border-[#161614] px-3 py-1.5 font-mono text-xs font-bold uppercase transition-colors sm:inline-block ${
                  pathname === "/register"
                    ? "bg-[#FFD646] text-[#161614]"
                    : "bg-[#161614] text-[#F5F0E6] hover:bg-[#2E2C28]"
                }`}
              >
                Daftar Pro
              </Link>
            </>
          )}
        </nav>
      </div>
    </header>
  );
}
