"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { RequireAdmin } from "@/components/Guards";
import { useToast } from "@/components/Providers";
import { listUsers, setUserPlan } from "@/lib/data";
import type { UserRow } from "@/lib/types";

function formatDate(value: number) {
  return new Intl.DateTimeFormat("es-PE", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  }).format(new Date(value));
}

function AdminInner() {
  const toast = useToast();
  const [users, setUsers] = useState<UserRow[]>([]);
  const [total, setTotal] = useState(0);
  const [query, setQuery] = useState("");
  const [loaded, setLoaded] = useState(false);
  const [loadingMore, setLoadingMore] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [changing, setChanging] = useState<string | null>(null);

  const loadUsers = useCallback(async (offset: number) => {
    try {
      const page = await listUsers(offset);
      setTotal(page.total);
      setUsers((prev) => (offset === 0 ? page.users : [...prev, ...page.users]));
      return true;
    } catch {
      toast("No se pudo cargar el registro de usuarios.", "error");
      return false;
    } finally {
      setLoaded(true);
    }
  }, [toast]);

  useEffect(() => {
    void loadUsers(0);
  }, [loadUsers]);

  async function refresh() {
    setRefreshing(true);
    const ok = await loadUsers(0);
    if (ok) toast("Registro actualizado.", "ok");
    setRefreshing(false);
  }

  async function loadMore() {
    if (loadingMore || users.length >= total) return;
    setLoadingMore(true);
    await loadUsers(users.length);
    setLoadingMore(false);
  }

  async function changePlan(u: UserRow, plan: UserRow["plan"]) {
    if (u.plan === plan) return;
    setChanging(u.uid);
    try {
      await setUserPlan(u.uid, plan);
      setUsers((list) => list.map((x) => (x.uid === u.uid ? { ...x, plan } : x)));
      toast(`Plan de @${u.username}: ${plan}.`, "ok");
    } catch (err) {
      toast(err instanceof Error ? err.message : "No se pudo cambiar el plan.", "error");
    } finally {
      setChanging(null);
    }
  }

  const filteredUsers = useMemo(() => {
    const term = query.trim().toLocaleLowerCase("es");
    if (!term) return users;
    return users.filter((u) =>
      [u.username, u.displayName, u.email, u.uid]
        .some((value) => value.toLocaleLowerCase("es").includes(term)),
    );
  }, [users, query]);

  const verified = users.filter((u) => u.emailVerified).length;
  const pending = users.length - verified;
  const upgraded = users.filter((u) => u.plan !== "free").length;

  return (
    <div className="relative space-y-7 pb-10">
      <div className="pointer-events-none absolute -right-16 -top-20 -z-10 h-72 w-72 rounded-full bg-violet-500/10 blur-3xl" />
      <div className="pointer-events-none absolute -left-16 top-64 -z-10 h-56 w-56 rounded-full bg-emerald-400/5 blur-3xl" />

      <header className="flex flex-col justify-between gap-5 sm:flex-row sm:items-end">
        <div>
          <div className="mb-3 inline-flex items-center gap-2 rounded-full border border-violet-400/20 bg-violet-400/10 px-3 py-1 text-xs font-semibold tracking-wide text-violet-300">
            <span className="h-1.5 w-1.5 rounded-full bg-emerald-400 shadow-[0_0_10px_rgba(52,211,153,.8)]" />
            CENTRO DE CONTROL
          </div>
          <h1 className="text-3xl font-extrabold tracking-tight sm:text-4xl">
            Administración <span className="text-violet-300">YuiAPI</span>
          </h1>
          <p className="mt-2 max-w-2xl text-sm text-muted sm:text-base">
            Gestiona las cuentas y los niveles de acceso de la plataforma desde un solo lugar.
          </p>
        </div>
        <button
          type="button"
          onClick={refresh}
          disabled={refreshing}
          className="inline-flex min-h-11 items-center justify-center gap-2 rounded-xl border border-violet-400/25 bg-violet-400/10 px-4 text-sm font-semibold text-violet-200 transition hover:border-violet-300/50 hover:bg-violet-400/15 disabled:cursor-wait disabled:opacity-60"
        >
          <span aria-hidden="true" className={refreshing ? "animate-spin" : ""}>↻</span>
          {refreshing ? "Actualizando…" : "Actualizar datos"}
        </button>
      </header>

      <section aria-label="Resumen de usuarios" className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <article className="group rounded-2xl border border-violet-400/20 bg-gradient-to-br from-violet-500/15 to-surface/80 p-4 shadow-lg shadow-violet-950/10">
          <div className="flex items-center justify-between">
            <span className="text-sm text-muted">Usuarios registrados</span>
            <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-violet-400/15 text-lg text-violet-200" aria-hidden="true">♙</span>
          </div>
          <p className="mt-3 text-3xl font-extrabold tracking-tight tabular-nums">{loaded ? total.toLocaleString("es-PE") : "—"}</p>
          <p className="mt-1 text-xs text-muted">Total de cuentas en la plataforma</p>
        </article>

        <article className="rounded-2xl border border-emerald-400/20 bg-gradient-to-br from-emerald-400/10 to-surface/80 p-4">
          <div className="flex items-center justify-between">
            <span className="text-sm text-muted">Correos verificados</span>
            <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-emerald-400/10 text-lg text-emerald-300" aria-hidden="true">✓</span>
          </div>
          <p className="mt-3 text-3xl font-extrabold tracking-tight tabular-nums">{loaded ? verified.toLocaleString("es-PE") : "—"}</p>
          <p className="mt-1 text-xs text-muted">Entre los {users.length} usuarios cargados</p>
        </article>

        <article className="rounded-2xl border border-amber-400/20 bg-gradient-to-br from-amber-400/10 to-surface/80 p-4">
          <div className="flex items-center justify-between">
            <span className="text-sm text-muted">Pendientes de verificar</span>
            <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-amber-400/10 text-lg text-amber-300" aria-hidden="true">◷</span>
          </div>
          <p className="mt-3 text-3xl font-extrabold tracking-tight tabular-nums">{loaded ? pending.toLocaleString("es-PE") : "—"}</p>
          <p className="mt-1 text-xs text-muted">Entre los {users.length} usuarios cargados</p>
        </article>

        <article className="rounded-2xl border border-cyan-400/20 bg-gradient-to-br from-cyan-400/10 to-surface/80 p-4">
          <div className="flex items-center justify-between">
            <span className="text-sm text-muted">Planes superiores</span>
            <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-cyan-400/10 text-lg text-cyan-300" aria-hidden="true">✦</span>
          </div>
          <p className="mt-3 text-3xl font-extrabold tracking-tight tabular-nums">{loaded ? upgraded.toLocaleString("es-PE") : "—"}</p>
          <p className="mt-1 text-xs text-muted">Pro y Ultra entre los cargados</p>
        </article>
      </section>

      <section aria-labelledby="users-heading" className="overflow-hidden rounded-2xl border border-line bg-surface/80 shadow-2xl shadow-black/10 backdrop-blur-xl">
        <div className="flex flex-col gap-4 border-b border-line p-4 sm:p-5 md:flex-row md:items-center md:justify-between">
          <div>
            <div className="flex items-center gap-2">
              <h2 id="users-heading" className="text-lg font-bold sm:text-xl">Directorio de usuarios</h2>
              <span className="rounded-full border border-line bg-surface2 px-2.5 py-1 text-xs font-semibold text-muted">{total}</span>
            </div>
            <p className="mt-1 text-sm text-muted">Consulta cuentas y administra sus planes de API.</p>
          </div>
          <label className="relative block w-full md:max-w-xs">
            <span className="sr-only">Buscar usuarios</span>
            <span className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-muted" aria-hidden="true">⌕</span>
            <input
              type="search"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Buscar usuario, correo o ID…"
              className="min-h-11 w-full rounded-xl border border-line bg-bg/80 pl-9 pr-3 text-sm text-ink outline-none transition placeholder:text-muted/70 focus:border-violet-400/60 focus:ring-2 focus:ring-violet-400/15"
            />
          </label>
        </div>

        {!loaded ? (
          <div className="space-y-3 p-5" role="status" aria-label="Cargando usuarios">
            <div className="h-12 animate-pulse rounded-xl bg-surface2/70" />
            <div className="h-12 animate-pulse rounded-xl bg-surface2/70" />
            <div className="h-12 animate-pulse rounded-xl bg-surface2/70" />
          </div>
        ) : users.length === 0 ? (
          <div className="px-5 py-14 text-center">
            <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-violet-400/10 text-2xl text-violet-300" aria-hidden="true">♙</div>
            <p className="mt-4 font-semibold">Todavía no hay usuarios registrados</p>
            <p className="mt-1 text-sm text-muted">Cuando se creen cuentas, aparecerán en este directorio.</p>
          </div>
        ) : filteredUsers.length === 0 ? (
          <div className="px-5 py-12 text-center">
            <p className="font-semibold">No encontramos coincidencias</p>
            <p className="mt-1 text-sm text-muted">Prueba con otro nombre, correo o identificador.</p>
            <button type="button" onClick={() => setQuery("")} className="mt-4 text-sm font-semibold text-violet-300 hover:text-violet-200">Limpiar búsqueda</button>
          </div>
        ) : (
          <>
            <div className="flex items-center justify-between px-4 py-3 text-xs text-muted sm:px-5">
              <span>Mostrando {filteredUsers.length} de {users.length} cargados</span>
              <span className="hidden sm:inline">Los cambios de plan se guardan al instante</span>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full min-w-[760px] text-left text-sm">
                <thead className="bg-bg/60 text-xs uppercase tracking-wider text-muted">
                  <tr>
                    <th scope="col" className="px-5 py-3 font-semibold">Cuenta</th>
                    <th scope="col" className="px-4 py-3 font-semibold">Correo</th>
                    <th scope="col" className="px-4 py-3 font-semibold">Verificación</th>
                    <th scope="col" className="px-4 py-3 font-semibold">Plan API</th>
                    <th scope="col" className="px-4 py-3 font-semibold">Registro</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredUsers.map((u) => (
                    <tr key={u.uid} className="border-t border-line/70 transition hover:bg-violet-400/[0.035]">
                      <td className="px-5 py-4">
                        <div className="flex items-center gap-3">
                          <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border border-violet-400/20 bg-gradient-to-br from-violet-400/20 to-emerald-400/10 font-bold text-violet-200">
                            {(u.displayName || u.username || "?").slice(0, 1).toUpperCase()}
                          </span>
                          <span className="min-w-0">
                            <span className="block truncate font-semibold text-ink">{u.displayName || u.username}</span>
                            <span className="block truncate text-xs text-muted">@{u.username}</span>
                          </span>
                        </div>
                      </td>
                      <td className="px-4 py-4 text-muted">{u.email}</td>
                      <td className="px-4 py-4">
                        {u.emailVerified ? (
                          <span className="inline-flex items-center gap-1.5 rounded-full border border-emerald-400/20 bg-emerald-400/10 px-2.5 py-1 text-xs font-semibold text-emerald-300">
                            <span className="h-1.5 w-1.5 rounded-full bg-emerald-400" /> Verificado
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1.5 rounded-full border border-amber-400/20 bg-amber-400/10 px-2.5 py-1 text-xs font-semibold text-amber-300">
                            <span className="h-1.5 w-1.5 rounded-full bg-amber-400" /> Pendiente
                          </span>
                        )}
                      </td>
                      <td className="px-4 py-4">
                        <label className="sr-only" htmlFor={`plan-${u.uid}`}>Plan de @{u.username}</label>
                        <select
                          id={`plan-${u.uid}`}
                          className="min-h-9 rounded-lg border border-line bg-bg px-3 text-xs font-semibold text-ink outline-none transition focus:border-violet-400/60 focus:ring-2 focus:ring-violet-400/15 disabled:opacity-50"
                          value={u.plan}
                          disabled={changing === u.uid}
                          onChange={(e) => changePlan(u, e.target.value as UserRow["plan"])}
                        >
                          <option value="free">Free</option>
                          <option value="pro">Pro</option>
                          <option value="ultra">Ultra</option>
                        </select>
                        {changing === u.uid && <span className="ml-2 text-xs text-muted">Guardando…</span>}
                      </td>
                      <td className="px-4 py-4 whitespace-nowrap text-muted">{formatDate(u.createdAt)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <div className="flex flex-col gap-3 border-t border-line bg-bg/30 px-4 py-4 sm:flex-row sm:items-center sm:justify-between sm:px-5">
              <p className="text-xs text-muted">Cargados {users.length} de {total} usuarios</p>
              {users.length < total && (
                <button
                  type="button"
                  className="inline-flex min-h-10 items-center justify-center rounded-xl border border-line bg-surface px-4 text-sm font-semibold text-ink transition hover:border-violet-400/40 hover:bg-surface2 disabled:opacity-60"
                  onClick={loadMore}
                  disabled={loadingMore}
                >
                  {loadingMore ? "Cargando…" : "Cargar más usuarios"}
                </button>
              )}
            </div>
          </>
        )}
      </section>

      <p className="text-center text-xs text-muted">
        YuiAPI · Panel administrativo · Acceso restringido
      </p>
    </div>
  );
}

export default function AdminPage() {
  return (
    <RequireAdmin>
      <AdminInner />
    </RequireAdmin>
  );
}
