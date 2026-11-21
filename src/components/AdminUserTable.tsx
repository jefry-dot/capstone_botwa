"use client";

import { useCallback, useEffect, useState } from "react";
import {
  Users,
  Search,
  Ban,
  UserCheck,
  Loader2,
  AlertCircle,
  RefreshCw,
} from "lucide-react";

interface AdminWaUserRow {
  wa_id: string;
  masked_wa_id: string;
  profile_name: string | null;
  total_stickers: number;
  first_seen_at: string;
  last_active_at: string;
  is_blocked: boolean;
  blocked_reason: string | null;
  blocked_at: string | null;
}

interface AdminUserTableProps {
  onUnauthorized?: () => void;
}

function formatWibShort(isoString: string): string {
  const date = new Date(isoString);
  if (Number.isNaN(date.getTime())) return "-";
  return new Intl.DateTimeFormat("id-ID", {
    timeZone: "Asia/Jakarta",
    day: "2-digit",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  })
    .format(date)
    .replace(/\./g, ":");
}

class UnauthorizedUsersError extends Error {
  constructor() {
    super("Sesi admin telah berakhir. Silakan login ulang.");
    this.name = "UnauthorizedUsersError";
  }
}

async function requestWaUsers(
  currentFilter: string,
  currentSearch: string
): Promise<AdminWaUserRow[]> {
  const params = new URLSearchParams({ filter: currentFilter });
  if (currentSearch.trim()) {
    params.set("search", currentSearch.trim());
  }

  const res = await fetch(`/api/admin/users?${params.toString()}`, {
    cache: "no-store",
  });

  if (res.status === 401 || res.status === 403) {
    throw new UnauthorizedUsersError();
  }

  const json = (await res.json().catch(() => ({}))) as {
    users?: AdminWaUserRow[];
    error?: string;
  };

  if (!res.ok || !json.users) {
    throw new Error(json.error || `Gagal memuat daftar user (${res.status}).`);
  }

  return json.users;
}

export default function AdminUserTable({
  onUnauthorized,
}: AdminUserTableProps) {
  const [users, setUsers] = useState<AdminWaUserRow[]>([]);
  const [filter, setFilter] = useState<"all" | "active" | "blocked">("all");
  const [searchInput, setSearchInput] = useState("");
  const [appliedSearch, setAppliedSearch] = useState("");

  const [isLoading, setIsLoading] = useState(true);
  const [busyWaId, setBusyWaId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const fetchUsers = useCallback(
    async (currentFilter: string, currentSearch: string) => {
      setIsLoading(true);
      setError(null);

      try {
        const list = await requestWaUsers(currentFilter, currentSearch);
        setUsers(list);
      } catch (err) {
        if (err instanceof UnauthorizedUsersError) {
          onUnauthorized?.();
        }
        setError(
          err instanceof Error ? err.message : "Gagal memuat data pengguna WA."
        );
      } finally {
        setIsLoading(false);
      }
    },
    [onUnauthorized]
  );

  useEffect(() => {
    let active = true;

    requestWaUsers(filter, appliedSearch)
      .then((list) => {
        if (!active) return;
        setUsers(list);
        setError(null);
      })
      .catch((err: unknown) => {
        if (!active) return;
        if (err instanceof UnauthorizedUsersError) {
          onUnauthorized?.();
        }
        setError(
          err instanceof Error ? err.message : "Gagal memuat data pengguna WA."
        );
      })
      .finally(() => {
        if (!active) return;
        setIsLoading(false);
      });

    return () => {
      active = false;
    };
  }, [filter, appliedSearch, onUnauthorized]);

  async function handleToggleBlock(user: AdminWaUserRow) {
    const nextBlocked = !user.is_blocked;
    let reason = "";

    if (nextBlocked) {
      const input = window.prompt(
        `Alasan memblokir ${user.profile_name || user.masked_wa_id} (opsional):`,
        "Spam permintaan stiker"
      );
      if (input === null) return; // Admin membatalkan prompt
      reason = input.trim();
    }

    setBusyWaId(user.wa_id);
    setError(null);

    try {
      const res = await fetch("/api/admin/users", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          wa_id: user.wa_id,
          is_blocked: nextBlocked,
          blocked_reason: reason,
        }),
      });

      if (res.status === 401 || res.status === 403) {
        onUnauthorized?.();
        throw new Error("Sesi admin telah berakhir.");
      }

      const json = (await res.json().catch(() => ({}))) as {
        user?: AdminWaUserRow;
        error?: string;
      };

      if (!res.ok || !json.user) {
        throw new Error(json.error || "Gagal memperbarui status blokir.");
      }

      const updatedUser = json.user;
      setUsers((prev) =>
        prev
          .map((item) => (item.wa_id === updatedUser.wa_id ? updatedUser : item))
          .filter((item) => {
            if (filter === "blocked") return item.is_blocked;
            if (filter === "active") return !item.is_blocked;
            return true;
          })
      );
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "Gagal memperbarui status user."
      );
    } finally {
      setBusyWaId(null);
    }
  }

  return (
    <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-xs">
      {/* Header & Filter Toolbar */}
      <div className="flex flex-col justify-between gap-4 border-b border-slate-200 p-5 md:flex-row md:items-center">
        <div>
          <h2 className="text-base font-bold text-slate-900">
            Moderasi Pengguna WhatsApp
          </h2>
          <p className="text-xs text-slate-500">
            Pengguna yang diblokir akan otomatis diabaikan oleh webhook bot
            untuk menghemat kuota API.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          {/* Pencarian */}
          <form
            onSubmit={(e) => {
              e.preventDefault();
              if (searchInput !== appliedSearch) {
                setIsLoading(true);
                setError(null);
                setAppliedSearch(searchInput);
              } else {
                void fetchUsers(filter, appliedSearch);
              }
            }}
            className="relative flex-1 sm:flex-initial"
          >
            <Search className="pointer-events-none absolute top-1/2 left-3 h-4 w-4 -translate-y-1/2 text-slate-400" />
            <input
              type="text"
              value={searchInput}
              onChange={(e) => setSearchInput(e.target.value)}
              placeholder="Cari nama / nomor..."
              className="w-full rounded-xl border border-slate-300 py-2 pr-3 pl-9 text-xs text-slate-900 focus:border-slate-900 focus:outline-none sm:w-48"
            />
          </form>

          {/* Filter Tab */}
          <div className="inline-flex rounded-xl bg-slate-100 p-1 text-xs font-semibold">
            {(
              [
                { id: "all", label: "Semua" },
                { id: "active", label: "Aktif" },
                { id: "blocked", label: "Diblokir" },
              ] as const
            ).map((opt) => (
              <button
                key={opt.id}
                type="button"
                onClick={() => {
                  if (filter !== opt.id) {
                    setIsLoading(true);
                    setError(null);
                    setFilter(opt.id);
                  }
                }}
                className={`rounded-lg px-2.5 py-1 transition-colors ${
                  filter === opt.id
                    ? "bg-white text-slate-900 shadow-xs"
                    : "text-slate-600 hover:text-slate-900"
                }`}
              >
                {opt.label}
              </button>
            ))}
          </div>

          <button
            type="button"
            onClick={() => void fetchUsers(filter, appliedSearch)}
            disabled={isLoading}
            className="inline-flex items-center gap-1.5 rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-50 disabled:opacity-60"
          >
            <RefreshCw
              className={`h-3.5 w-3.5 ${isLoading ? "animate-spin" : ""}`}
            />
            <span>Muat Ulang</span>
          </button>
        </div>
      </div>

      {error && (
        <div className="m-4 flex items-start gap-2.5 rounded-xl border border-red-200 bg-red-50 p-3.5 text-xs text-red-700">
          <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />
          <span>{error}</span>
        </div>
      )}

      {isLoading ? (
        <div className="flex items-center justify-center py-16 text-slate-500">
          <Loader2 className="h-6 w-6 animate-spin text-slate-400" />
          <span className="ml-2 text-xs font-medium">
            Memuat daftar pengguna WhatsApp...
          </span>
        </div>
      ) : users.length === 0 ? (
        <div className="flex flex-col items-center justify-center px-6 py-14 text-center text-slate-500">
          <Users className="mb-2 h-8 w-8 opacity-40" />
          <p className="text-sm font-medium">Tidak ada pengguna ditemukan</p>
          <p className="mt-1 text-xs">
            Pengguna WhatsApp akan tercatat otomatis setelah mengirim pesan ke
            bot.
          </p>
        </div>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs sm:text-sm">
            <thead>
              <tr className="border-b border-slate-200 bg-slate-50 text-[11px] font-semibold tracking-wider text-slate-500 uppercase">
                <th className="px-5 py-3">Pengguna</th>
                <th className="px-4 py-3">Nomor (Tersensor)</th>
                <th className="px-4 py-3 text-right">Total Stiker</th>
                <th className="px-4 py-3">Aktivitas Terakhir</th>
                <th className="px-4 py-3">Status</th>
                <th className="px-5 py-3 text-right">Aksi</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {users.map((user) => {
                const isBusy = busyWaId === user.wa_id;
                return (
                  <tr
                    key={user.wa_id}
                    className="transition-colors hover:bg-slate-50/80"
                  >
                    <td className="px-5 py-3.5">
                      <p className="font-semibold text-slate-900">
                        {user.profile_name || "User WA"}
                      </p>
                      {user.is_blocked && user.blocked_reason && (
                        <p className="mt-0.5 text-[11px] text-red-600">
                          Alasan: {user.blocked_reason}
                        </p>
                      )}
                    </td>
                    <td className="whitespace-nowrap px-4 py-3.5 font-mono text-xs text-slate-600">
                      {user.masked_wa_id}
                    </td>
                    <td className="whitespace-nowrap px-4 py-3.5 text-right font-mono text-xs font-bold text-slate-800">
                      {user.total_stickers.toLocaleString("id-ID")}
                    </td>
                    <td className="whitespace-nowrap px-4 py-3.5 font-mono text-xs text-slate-600">
                      {formatWibShort(user.last_active_at)} WIB
                    </td>
                    <td className="whitespace-nowrap px-4 py-3.5">
                      {user.is_blocked ? (
                        <span className="inline-flex items-center gap-1 rounded-full bg-red-50 px-2.5 py-0.5 text-xs font-semibold text-red-700">
                          <Ban className="h-3 w-3" />
                          Diblokir
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1 rounded-full bg-emerald-50 px-2.5 py-0.5 text-xs font-semibold text-emerald-700">
                          <UserCheck className="h-3 w-3" />
                          Aktif
                        </span>
                      )}
                    </td>
                    <td className="whitespace-nowrap px-5 py-3.5 text-right">
                      <button
                        type="button"
                        disabled={isBusy}
                        onClick={() => void handleToggleBlock(user)}
                        className={`inline-flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-semibold transition-colors disabled:opacity-50 ${
                          user.is_blocked
                            ? "border border-emerald-200 bg-emerald-50 text-emerald-700 hover:bg-emerald-100"
                            : "border border-red-200 bg-red-50 text-red-700 hover:bg-red-100"
                        }`}
                      >
                        {isBusy ? (
                          <Loader2 className="h-3.5 w-3.5 animate-spin" />
                        ) : user.is_blocked ? (
                          <UserCheck className="h-3.5 w-3.5" />
                        ) : (
                          <Ban className="h-3.5 w-3.5" />
                        )}
                        <span>
                          {user.is_blocked ? "Buka Blokir" : "Blokir"}
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