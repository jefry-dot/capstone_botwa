"use client";

import { useCallback, useEffect, useState } from "react";
import {
  Crown,
  Search,
  RefreshCw,
  Loader2,
  AlertCircle,
  Users,
  Link2,
} from "lucide-react";

interface AdminMemberRow {
  id: string;
  email: string;
  full_name: string;
  plan: "free" | "pro";
  is_pro_active: boolean;
  pro_expires_at: string | null;
  custom_pack_name: string | null;
  custom_pack_author: string | null;
  masked_wa_id: string | null;
  created_at: string;
}

interface AdminMembersTableProps {
  onUnauthorized?: () => void;
}

class UnauthorizedMembersError extends Error {
  constructor() {
    super("Sesi admin telah berakhir.");
    this.name = "UnauthorizedMembersError";
  }
}

async function fetchMembersList(
  planFilter: string,
  search: string
): Promise<AdminMemberRow[]> {
  const params = new URLSearchParams({ plan: planFilter });
  if (search.trim()) params.set("search", search.trim());

  const res = await fetch(`/api/admin/members?${params.toString()}`, {
    cache: "no-store",
  });
  if (res.status === 401 || res.status === 403) {
    throw new UnauthorizedMembersError();
  }
  const json = (await res.json().catch(() => ({}))) as {
    members?: AdminMemberRow[];
    error?: string;
  };
  if (!res.ok || !json.members) {
    throw new Error(json.error || `Gagal memuat daftar member (${res.status}).`);
  }
  return json.members;
}

function formatShortDate(iso: string | null): string {
  if (!iso) return "-";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "-";
  return new Intl.DateTimeFormat("id-ID", {
    timeZone: "Asia/Jakarta",
    day: "2-digit",
    month: "short",
    year: "numeric",
  }).format(d);
}

export default function AdminMembersTable({
  onUnauthorized,
}: AdminMembersTableProps) {
  const [members, setMembers] = useState<AdminMemberRow[]>([]);
  const [planFilter, setPlanFilter] = useState<"all" | "pro" | "free">("all");
  const [searchInput, setSearchInput] = useState("");
  const [appliedSearch, setAppliedSearch] = useState("");

  const [isLoading, setIsLoading] = useState(true);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const reload = useCallback(
    async (plan: string, search: string) => {
      setIsLoading(true);
      setError(null);
      try {
        const list = await fetchMembersList(plan, search);
        setMembers(list);
      } catch (err) {
        if (err instanceof UnauthorizedMembersError) {
          onUnauthorized?.();
        }
        setError(
          err instanceof Error ? err.message : "Gagal memuat akun web."
        );
      } finally {
        setIsLoading(false);
      }
    },
    [onUnauthorized]
  );

  useEffect(() => {
    let active = true;
    fetchMembersList(planFilter, appliedSearch)
      .then((list) => {
        if (!active) return;
        setMembers(list);
        setError(null);
      })
      .catch((err: unknown) => {
        if (!active) return;
        if (err instanceof UnauthorizedMembersError) {
          onUnauthorized?.();
        }
        setError(
          err instanceof Error ? err.message : "Gagal memuat akun web."
        );
      })
      .finally(() => {
        if (!active) return;
        setIsLoading(false);
      });

    return () => {
      active = false;
    };
  }, [planFilter, appliedSearch, onUnauthorized]);

  async function handleTogglePlan(member: AdminMemberRow) {
    const nextPlan: "free" | "pro" = member.is_pro_active ? "free" : "pro";
    setBusyId(member.id);
    setError(null);

    try {
      const res = await fetch("/api/admin/members", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          userId: member.id,
          plan: nextPlan,
        }),
      });

      if (res.status === 401 || res.status === 403) {
        onUnauthorized?.();
        throw new Error("Sesi admin habis.");
      }

      const json = (await res.json().catch(() => ({}))) as {
        member?: AdminMemberRow;
        error?: string;
      };
      if (!res.ok || !json.member) {
        throw new Error(json.error || "Gagal mengubah paket user.");
      }

      const updated = json.member;
      setMembers((prev) =>
        prev
          .map((item) => (item.id === updated.id ? updated : item))
          .filter((item) => {
            if (planFilter === "pro") return item.is_pro_active;
            if (planFilter === "free") return !item.is_pro_active;
            return true;
          })
      );
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "Gagal memperbarui status Pro."
      );
    } finally {
      setBusyId(null);
    }
  }

  return (
    <div className="zine-card overflow-hidden">
      <div className="flex flex-col justify-between gap-4 border-b-2 border-[#161614] p-5 md:flex-row md:items-center">
        <div>
          <h2 className="font-display text-base font-bold text-[#161614]">
            Manajemen Akun Web &amp; Paket Pro
          </h2>
          <p className="font-mono text-[11px] text-[#5C584F]">
            Pantau user terdaftar di portal web, tautan WhatsApp, dan atur
            status PRO secara manual.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <form
            onSubmit={(e) => {
              e.preventDefault();
              if (searchInput !== appliedSearch) {
                setIsLoading(true);
                setError(null);
                setAppliedSearch(searchInput);
              } else {
                void reload(planFilter, appliedSearch);
              }
            }}
            className="relative flex-1 sm:flex-initial"
          >
            <Search className="pointer-events-none absolute top-1/2 left-3 h-4 w-4 -translate-y-1/2 text-[#5C584F]" />
            <input
              type="text"
              value={searchInput}
              onChange={(e) => setSearchInput(e.target.value)}
              placeholder="Cari nama / email..."
              className="w-full border-2 border-[#161614] bg-[#FFFDF7] py-1.5 pr-3 pl-9 font-mono text-xs text-[#161614] focus:bg-[#FFFBEB] focus:outline-none sm:w-48"
            />
          </form>

          <div className="inline-flex border-2 border-[#161614] bg-[#EFE7D8] p-0.5 font-mono text-xs font-bold">
            {(
              [
                { id: "all", label: "Semua" },
                { id: "pro", label: "PRO" },
                { id: "free", label: "Free" },
              ] as const
            ).map((opt) => (
              <button
                key={opt.id}
                type="button"
                onClick={() => {
                  if (planFilter !== opt.id) {
                    setIsLoading(true);
                    setError(null);
                    setPlanFilter(opt.id);
                  }
                }}
                className={`cursor-pointer px-2.5 py-1 transition-colors ${
                  planFilter === opt.id
                    ? "bg-[#161614] text-[#F5F0E6]"
                    : "text-[#3B3934] hover:text-[#161614]"
                }`}
              >
                {opt.label}
              </button>
            ))}
          </div>

          <button
            type="button"
            onClick={() => void reload(planFilter, appliedSearch)}
            disabled={isLoading}
            className="zine-btn inline-flex cursor-pointer items-center gap-1.5 bg-[#FFFDF7] px-3 py-1.5 font-mono text-xs font-bold text-[#161614] disabled:opacity-60"
          >
            <RefreshCw
              className={`h-3.5 w-3.5 ${isLoading ? "animate-spin" : ""}`}
            />
            <span>Muat Ulang</span>
          </button>
        </div>
      </div>

      {error && (
        <div className="m-4 flex items-start gap-2.5 border-2 border-[#161614] bg-[#EB3B2E] p-3.5 text-xs font-medium text-white shadow-[2px_2px_0_#161614]">
          <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />
          <span>{error}</span>
        </div>
      )}

      {isLoading ? (
        <div className="flex items-center justify-center bg-[#F5F0E6] py-16 text-[#45433D]">
          <Loader2 className="h-6 w-6 animate-spin text-[#161614]" />
          <span className="ml-2 font-mono text-xs font-bold">
            Memuat daftar akun web...
          </span>
        </div>
      ) : members.length === 0 ? (
        <div className="flex flex-col items-center justify-center bg-[#F5F0E6] px-6 py-14 text-center text-[#5C584F]">
          <Users className="mb-2 h-8 w-8 opacity-50" />
          <p className="font-display text-sm font-bold text-[#161614]">
            Belum ada akun web terdaftar
          </p>
          <p className="mt-1 font-mono text-xs">
            Akun pengguna akan muncul di sini setelah mendaftar lewat halaman
            /register.
          </p>
        </div>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs sm:text-sm">
            <thead>
              <tr className="border-b-2 border-[#161614] bg-[#EFE7D8] font-mono text-[11px] font-bold tracking-wider text-[#161614] uppercase">
                <th className="px-5 py-3">Pengguna</th>
                <th className="px-4 py-3">Tautan WA</th>
                <th className="px-4 py-3">Custom Pack EXIF</th>
                <th className="px-4 py-3">Paket</th>
                <th className="px-5 py-3 text-right">Aksi Admin</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[#161614]/15">
              {members.map((m) => {
                const isBusy = busyId === m.id;
                return (
                  <tr key={m.id} className="hover:bg-[#F5F0E6]/80">
                    <td className="px-5 py-3.5">
                      <p className="font-semibold text-[#161614]">
                        {m.full_name}
                      </p>
                      <p className="font-mono text-[11px] text-[#5C584F]">
                        {m.email}
                      </p>
                    </td>
                    <td className="whitespace-nowrap px-4 py-3.5 font-mono text-xs">
                      {m.masked_wa_id ? (
                        <span className="inline-flex items-center gap-1 border border-[#161614] bg-[#B9F32B]/40 px-2 py-0.5 font-bold text-[#161614]">
                          <Link2 className="h-3 w-3" />
                          {m.masked_wa_id}
                        </span>
                      ) : (
                        <span className="text-[#8E897E]">Belum ditautkan</span>
                      )}
                    </td>
                    <td className="px-4 py-3.5 font-mono text-xs text-[#45433D]">
                      {m.custom_pack_name || (
                        <span className="text-[#8E897E]">Default</span>
                      )}
                    </td>
                    <td className="whitespace-nowrap px-4 py-3.5">
                      {m.is_pro_active ? (
                        <div>
                          <span className="inline-flex items-center gap-1 border border-[#161614] bg-[#FFD646] px-2 py-0.5 font-mono text-[11px] font-bold text-[#161614]">
                            <Crown className="h-3 w-3" />
                            PRO
                          </span>
                          <p className="mt-0.5 font-mono text-[10px] text-[#5C584F]">
                            s/d {formatShortDate(m.pro_expires_at)}
                          </p>
                        </div>
                      ) : (
                        <span className="inline-block border border-[#161614] bg-[#EFE7D8] px-2 py-0.5 font-mono text-[11px] font-bold text-[#3B3934]">
                          FREE
                        </span>
                      )}
                    </td>
                    <td className="whitespace-nowrap px-5 py-3.5 text-right">
                      <button
                        type="button"
                        disabled={isBusy}
                        onClick={() => void handleTogglePlan(m)}
                        className={`zine-btn inline-flex cursor-pointer items-center gap-1.5 px-3 py-1.5 font-mono text-xs font-bold disabled:opacity-50 ${
                          m.is_pro_active
                            ? "bg-[#FFFDF7] text-[#EB3B2E]"
                            : "bg-[#B9F32B] text-[#161614]"
                        }`}
                      >
                        {isBusy ? (
                          <Loader2 className="h-3.5 w-3.5 animate-spin" />
                        ) : (
                          <Crown className="h-3.5 w-3.5" />
                        )}
                        <span>
                          {m.is_pro_active ? "Turunkan Free" : "Set PRO 30h"}
                        </span>
                      </button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
