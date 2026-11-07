"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { RequireAdmin } from "@/components/Guards";
import { useToast } from "@/components/Providers";
import { createAdminKey, deleteAdminPlan, getAdminAudit, getAdminKeyUsage, getAdminUser, listAdminKeys, listAdminPlans, listUsers, revokeAdminKey, rotateAdminKey, saveAdminPlan, setUserPlan, updateAdminKey, updateAdminUser } from "@/lib/data";
import type { AdminPlan, ApiKeyInfo, ApiKeyUsage } from "@/lib/data";
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
  const [selectedUser, setSelectedUser] = useState<UserRow | null>(null);
  const [activity, setActivity] = useState<{ at: number; type: string; detail: string }[]>([]);
  const [dailyLimit, setDailyLimit] = useState("");
  const [minuteLimit, setMinuteLimit] = useState("");
  const [role, setRole] = useState<"user" | "moderator">("user");
  const [canManageRoles, setCanManageRoles] = useState(false);
  const [savingProfile, setSavingProfile] = useState(false);
  const [audit, setAudit] = useState<{ at: number; actor: string; target: string; action: string; detail: string }[]>([]);
  const [adminKeys, setAdminKeys] = useState<ApiKeyInfo[]>([]);
  const [adminPlans, setAdminPlans] = useState<AdminPlan[]>([]);
  const [newKeyName, setNewKeyName] = useState("");
  const [revealedKey, setRevealedKey] = useState("");
  const [planName, setPlanName] = useState("");
  const [planDaily, setPlanDaily] = useState("500");
  const [planMinute, setPlanMinute] = useState("60");
  const [selectedPlan, setSelectedPlan] = useState("free");
  const [planDays, setPlanDays] = useState("");
  const [keyHistory, setKeyHistory] = useState<{ id: string; rows: ApiKeyUsage[] } | null>(null);

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
    void getAdminAudit().then(setAudit).catch(() => undefined);
    void listAdminPlans().then(setAdminPlans).catch(() => undefined);
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

  async function openUser(u: UserRow) {
    setSelectedUser(u);
    setActivity([]);
    try {
      const detail = await getAdminUser(u.uid);
      setSelectedUser(detail.user);
      setActivity(detail.activity);
      setCanManageRoles(detail.canManageRoles);
      setDailyLimit(detail.user.dailyLimit == null ? "" : String(detail.user.dailyLimit));
      setMinuteLimit(detail.user.minuteLimit == null ? "" : String(detail.user.minuteLimit));
      setRole(detail.user.role === "moderator" ? "moderator" : "user");
      setSelectedPlan(detail.user.plan);
      setPlanDays("");
      setRevealedKey("");
      setKeyHistory(null);
      setAdminKeys(await listAdminKeys(u.uid));
    } catch (err) {
      toast(err instanceof Error ? err.message : "No se pudo cargar el perfil.", "error");
    }
  }

  async function saveUserSettings() {
    if (!selectedUser) return;
    const daily = dailyLimit.trim() ? Number(dailyLimit) : null;
    const minute = minuteLimit.trim() ? Number(minuteLimit) : null;
    if ((daily !== null && (!Number.isInteger(daily) || daily < 1 || daily > 1000000)) ||
        (minute !== null && (!Number.isInteger(minute) || minute < 1 || minute > 10000))) {
      toast("Revisa los límites personalizados.", "error");
      return;
    }
    setSavingProfile(true);
    try {
      const updated = await updateAdminUser(selectedUser.uid, { dailyLimit: daily, minuteLimit: minute, ...(canManageRoles ? { role } : {}) });
      setSelectedUser(updated);
      setUsers((list) => list.map((x) => x.uid === updated.uid ? updated : x));
      const detail = await getAdminUser(updated.uid);
      setActivity(detail.activity);
      toast("Perfil administrativo actualizado.", "ok");
    } catch (err) {
      toast(err instanceof Error ? err.message : "No se pudieron guardar los cambios.", "error");
    } finally {
      setSavingProfile(false);
    }
  }

  async function toggleSuspension() {
    if (!selectedUser) return;
    const status = selectedUser.status === "suspended" ? "active" : "suspended";
    if (!window.confirm(status === "suspended" ? "¿Suspender esta cuenta? Se cerrarán sus sesiones y se bloqueará su API." : "¿Reactivar esta cuenta?")) return;
    setSavingProfile(true);
    try {
      const updated = await updateAdminUser(selectedUser.uid, { status });
      setSelectedUser(updated);
      setUsers((list) => list.map((x) => x.uid === updated.uid ? updated : x));
      const detail = await getAdminUser(updated.uid);
      setActivity(detail.activity);
      toast(status === "suspended" ? "Cuenta suspendida." : "Cuenta reactivada.", "ok");
    } catch (err) {
      toast(err instanceof Error ? err.message : "No se pudo cambiar el estado.", "error");
    } finally {
      setSavingProfile(false);
    }
  }


  async function createKeyForSelectedUser() {
    if (!selectedUser || !newKeyName.trim()) return;
    try {
      const result = await createAdminKey(selectedUser.uid, newKeyName.trim());
      setRevealedKey(result.key);
      setNewKeyName("");
      setAdminKeys(await listAdminKeys(selectedUser.uid));
      toast("Clave creada. Copia el secreto ahora; no volverá a mostrarse.", "ok");
    } catch (err) { toast(err instanceof Error ? err.message : "No se pudo crear la clave.", "error"); }
  }

  async function revokeKey(id: string) {
    if (!selectedUser || !window.confirm("¿Revocar esta clave? La integración que la usa dejará de funcionar.")) return;
    try {
      await revokeAdminKey(selectedUser.uid, id);
      setAdminKeys(await listAdminKeys(selectedUser.uid));
      if (keyHistory?.id === id) setKeyHistory(null);
      toast("Clave revocada.", "ok");
    } catch (err) { toast(err instanceof Error ? err.message : "No se pudo revocar la clave.", "error"); }
  }

  async function rotateKey(id: string) {
    if (!selectedUser || !window.confirm("¿Rotar esta clave? La clave anterior se revocará y tendrás que actualizar la integración.")) return;
    try {
      const result = await rotateAdminKey(selectedUser.uid, id);
      setRevealedKey(result.key);
      setAdminKeys(await listAdminKeys(selectedUser.uid));
      toast("Clave rotada. Copia el nuevo secreto ahora.", "ok");
    } catch (err) { toast(err instanceof Error ? err.message : "No se pudo rotar la clave.", "error"); }
  }

  async function editKeyLimits(key: ApiKeyInfo) {
    if (!selectedUser) return;
    const dailyRaw = window.prompt("Límite diario para esta clave (vacío = límite del usuario)", key.dailyLimit == null ? "" : String(key.dailyLimit));
    if (dailyRaw === null) return;
    const minuteRaw = window.prompt("Límite por minuto para esta clave (vacío = límite del usuario)", key.minuteLimit == null ? "" : String(key.minuteLimit));
    if (minuteRaw === null) return;
    const dailyLimit = dailyRaw.trim() ? Number(dailyRaw) : null;
    const minuteLimit = minuteRaw.trim() ? Number(minuteRaw) : null;
    try {
      await updateAdminKey(selectedUser.uid, key.id, { dailyLimit, minuteLimit });
      setAdminKeys(await listAdminKeys(selectedUser.uid));
      toast("Límites de clave actualizados.", "ok");
    } catch (err) { toast(err instanceof Error ? err.message : "Límites no válidos.", "error"); }
  }

  async function showKeyHistory(id: string) {
    if (!selectedUser) return;
    try { setKeyHistory({ id, rows: await getAdminKeyUsage(selectedUser.uid, id) }); }
    catch (err) { toast(err instanceof Error ? err.message : "No se pudo cargar el historial.", "error"); }
  }

  async function assignSelectedPlan() {
    if (!selectedUser) return;
    const days = planDays.trim() ? Number(planDays) : undefined;
    if (days !== undefined && (!Number.isInteger(days) || days < 1 || days > 3650)) {
      toast("La duración debe estar entre 1 y 3650 días.", "error");
      return;
    }
    try {
      await setUserPlan(selectedUser.uid, selectedPlan, days);
      const detail = await getAdminUser(selectedUser.uid);
      setSelectedUser(detail.user);
      setUsers((items) => items.map((item) => item.uid === selectedUser.uid ? detail.user : item));
      setActivity(detail.activity);
      toast("Plan asignado correctamente.", "ok");
    } catch (err) { toast(err instanceof Error ? err.message : "No se pudo asignar el plan.", "error"); }
  }

  async function createCustomPlan() {
    const perDay = Number(planDaily), perMinute = Number(planMinute);
    if (!planName.trim() || !Number.isInteger(perDay) || perDay < 1 || perDay > 1000000 || !Number.isInteger(perMinute) || perMinute < 1 || perMinute > 10000) {
      toast("Completa nombre y límites válidos para el plan.", "error");
      return;
    }
    try {
      const plan = await saveAdminPlan({ label: planName.trim(), perDay, perMinute });
      setAdminPlans((items) => [...items, plan]);
      setPlanName("");
      toast("Plan personalizado creado.", "ok");
    } catch (err) { toast(err instanceof Error ? err.message : "No se pudo crear el plan.", "error"); }
  }

  async function removeCustomPlan(id: string) {
    if (!window.confirm("¿Eliminar este plan personalizado? Solo se permite si ningún usuario lo tiene asignado.")) return;
    try {
      await deleteAdminPlan(id);
      setAdminPlans(await listAdminPlans());
      toast("Plan eliminado.", "ok");
    } catch (err) { toast(err instanceof Error ? err.message : "No se pudo eliminar; comprueba si está asignado.", "error"); }
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
                    <th scope="col" className="px-4 py-3 font-semibold">Gestión</th>
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
                      <td className="px-4 py-4"><button type="button" onClick={() => void openUser(u)} className="rounded-lg border border-violet-400/30 bg-violet-400/10 px-3 py-2 text-xs font-semibold text-violet-200 hover:bg-violet-400/20">Gestionar</button></td>
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

      {selectedUser && (
        <section className="rounded-2xl border border-violet-400/25 bg-surface/90 p-4 shadow-xl sm:p-6" aria-labelledby="profile-admin-title">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div>
              <p className="text-xs font-semibold uppercase tracking-wider text-violet-300">Ficha administrativa</p>
              <h2 id="profile-admin-title" className="mt-1 text-xl font-bold">{selectedUser.displayName} <span className="text-sm font-normal text-muted">@{selectedUser.username}</span></h2>
              <p className="mt-1 text-sm text-muted">{selectedUser.email} · {selectedUser.emailVerified ? "Correo verificado" : "Correo pendiente"} · ID: {selectedUser.uid}</p>
              <p className="mt-1 text-xs text-muted">Estado: {selectedUser.status === "suspended" ? "Suspendido" : "Activo"} · Rol: {selectedUser.role}</p>
            </div>
            <button type="button" onClick={() => setSelectedUser(null)} className="rounded-lg border border-line px-3 py-2 text-sm text-muted hover:bg-surface2">Cerrar</button>
          </div>
          <div className="mt-5 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            <label className="text-sm text-muted">Límite diario (vacío = plan)
              <input inputMode="numeric" value={dailyLimit} onChange={(e) => setDailyLimit(e.target.value)} placeholder="Automático" className="mt-1 min-h-10 w-full rounded-lg border border-line bg-bg px-3 text-ink outline-none focus:border-violet-400" />
            </label>
            <label className="text-sm text-muted">Límite por minuto (vacío = plan)
              <input inputMode="numeric" value={minuteLimit} onChange={(e) => setMinuteLimit(e.target.value)} placeholder="Automático" className="mt-1 min-h-10 w-full rounded-lg border border-line bg-bg px-3 text-ink outline-none focus:border-violet-400" />
            </label>
            {canManageRoles && <label className="text-sm text-muted">Rol
              <select value={role} onChange={(e) => setRole(e.target.value as "user" | "moderator")} className="mt-1 min-h-10 w-full rounded-lg border border-line bg-bg px-3 text-ink">
                <option value="user">Usuario</option><option value="moderator">Moderador</option>
              </select>
            </label>}
            <div className="flex items-end gap-2">
              <button type="button" onClick={() => void saveUserSettings()} disabled={savingProfile || selectedUser.role === "admin"} className="min-h-10 flex-1 rounded-lg bg-violet-500 px-3 text-sm font-semibold text-white disabled:opacity-50">{savingProfile ? "Guardando…" : "Guardar cambios"}</button>
              <button type="button" onClick={() => void toggleSuspension()} disabled={savingProfile || selectedUser.role === "admin"} className="min-h-10 rounded-lg border border-rose-400/30 px-3 text-sm font-semibold text-rose-300 disabled:opacity-40">{selectedUser.status === "suspended" ? "Reactivar" : "Suspender"}</button>
            </div>
          </div>
          <div className="mt-6 border-t border-line pt-5">
            <h3 className="text-lg font-bold">API Keys del usuario</h3>
            <p className="mt-1 text-sm text-muted">Los secretos solo se muestran al crearlos o rotarlos.</p>
            <div className="mt-3 flex flex-col gap-2 sm:flex-row">
              <input value={newKeyName} onChange={(e) => setNewKeyName(e.target.value)} placeholder="Nombre de la clave (ej. Bot WhatsApp)" maxLength={40} className="min-h-10 flex-1 rounded-lg border border-line bg-bg px-3 text-sm text-ink" />
              <button type="button" onClick={() => void createKeyForSelectedUser()} className="rounded-lg bg-violet-500 px-4 py-2 text-sm font-semibold text-white">Crear clave</button>
            </div>
            {revealedKey && <div className="mt-3 rounded-xl border border-emerald-400/30 bg-emerald-400/10 p-3"><p className="text-xs font-semibold text-emerald-300">Secreto nuevo — cópialo ahora</p><code className="mt-2 block break-all text-sm text-ink">{revealedKey}</code><button type="button" onClick={() => { void navigator.clipboard?.writeText(revealedKey); toast("Clave copiada.", "ok"); }} className="mt-2 rounded-lg border border-emerald-400/30 px-3 py-1.5 text-xs font-semibold text-emerald-200">Copiar clave</button></div>}
            {adminKeys.length ? <div className="mt-3 space-y-2">{adminKeys.map((key) => <div key={key.id} className="rounded-xl border border-line bg-bg/50 p-3"><div className="flex flex-wrap items-center justify-between gap-2"><div><p className="font-semibold">{key.name}</p><p className="text-xs text-muted">{key.prefix}… · Último uso: {key.lastUsedAt ? new Date(key.lastUsedAt).toLocaleString("es-PE") : "Nunca"}</p><p className="text-xs text-muted">Límites: {key.dailyLimit ?? "usuario"}/día · {key.minuteLimit ?? "usuario"}/min</p></div><div className="flex flex-wrap gap-2"><button type="button" onClick={() => void showKeyHistory(key.id)} className="rounded-lg border border-line px-2.5 py-1.5 text-xs">Uso</button><button type="button" onClick={() => void editKeyLimits(key)} className="rounded-lg border border-line px-2.5 py-1.5 text-xs">Límites</button><button type="button" onClick={() => void rotateKey(key.id)} className="rounded-lg border border-amber-400/30 px-2.5 py-1.5 text-xs text-amber-300">Rotar</button><button type="button" onClick={() => void revokeKey(key.id)} className="rounded-lg border border-rose-400/30 px-2.5 py-1.5 text-xs text-rose-300">Revocar</button></div></div>{keyHistory?.id === key.id && <div className="mt-2 border-t border-line pt-2 text-xs text-muted">{keyHistory.rows.length ? keyHistory.rows.map((row) => <p key={row.day}>{row.day}: {row.requests.toLocaleString("es-PE")} solicitudes</p>) : "Sin historial de uso registrado todavía."}</div>}</div>)}</div> : <p className="mt-3 text-sm text-muted">Este usuario todavía no tiene claves.</p>}
          </div>
          <div className="mt-6 border-t border-line pt-5">
            <h3 className="text-lg font-bold">Plan y acceso temporal</h3>
            <div className="mt-3 grid gap-3 sm:grid-cols-3">
              <label className="text-sm text-muted">Plan<select value={selectedPlan} onChange={(e) => setSelectedPlan(e.target.value)} className="mt-1 min-h-10 w-full rounded-lg border border-line bg-bg px-3 text-ink">{adminPlans.map((plan) => <option key={plan.id} value={plan.id}>{plan.label} · {plan.perDay.toLocaleString("es-PE")}/día</option>)}</select></label>
              <label className="text-sm text-muted">Duración en días (vacío = permanente)<input value={planDays} onChange={(e) => setPlanDays(e.target.value)} inputMode="numeric" placeholder="Permanente" className="mt-1 min-h-10 w-full rounded-lg border border-line bg-bg px-3 text-ink" /></label>
              <div className="flex items-end"><button type="button" onClick={() => void assignSelectedPlan()} className="min-h-10 w-full rounded-lg bg-emerald-600 px-4 text-sm font-semibold text-white">Asignar plan</button></div>
            </div>
            {selectedUser.planExpiresAt && <p className="mt-2 text-xs text-muted">Acceso actual vence: {new Date(selectedUser.planExpiresAt).toLocaleString("es-PE")}</p>}
          </div>
          <div className="mt-5 border-t border-line pt-4">
            <h3 className="font-semibold">Historial de actividad</h3>
            {activity.length ? <ul className="mt-3 space-y-2">{activity.map((item, i) => <li key={i} className="flex flex-col gap-1 rounded-lg bg-bg/60 p-3 text-sm sm:flex-row sm:items-center sm:justify-between"><span>{item.detail}</span><span className="text-xs text-muted">{item.type} · {new Date(item.at).toLocaleString("es-PE")}</span></li>)}</ul> : <p className="mt-2 text-sm text-muted">Todavía no hay actividad registrada para esta cuenta.</p>}
          </div>
        </section>
      )}

      <section className="rounded-2xl border border-violet-400/20 bg-surface/80 p-4 sm:p-5">
        <h2 className="text-lg font-bold">Planes personalizados</h2>
        <p className="mt-1 text-sm text-muted">Define límites que se aplicarán realmente al autenticar cada solicitud.</p>
        <div className="mt-3 grid gap-3 sm:grid-cols-4">
          <input value={planName} onChange={(e) => setPlanName(e.target.value)} placeholder="Nombre del plan" maxLength={32} className="min-h-10 rounded-lg border border-line bg-bg px-3 text-sm text-ink" />
          <input value={planDaily} onChange={(e) => setPlanDaily(e.target.value)} inputMode="numeric" placeholder="Solicitudes/día" className="min-h-10 rounded-lg border border-line bg-bg px-3 text-sm text-ink" />
          <input value={planMinute} onChange={(e) => setPlanMinute(e.target.value)} inputMode="numeric" placeholder="Solicitudes/min" className="min-h-10 rounded-lg border border-line bg-bg px-3 text-sm text-ink" />
          <button type="button" onClick={() => void createCustomPlan()} className="min-h-10 rounded-lg bg-violet-500 px-4 text-sm font-semibold text-white">Crear plan</button>
        </div>
        <div className="mt-4 grid gap-2 sm:grid-cols-2 lg:grid-cols-3">{adminPlans.map((plan) => <div key={plan.id} className="flex items-center justify-between gap-3 rounded-xl border border-line bg-bg/50 p-3"><div><p className="font-semibold">{plan.label}</p><p className="text-xs text-muted">{plan.perDay.toLocaleString("es-PE")} al día · {plan.perMinute.toLocaleString("es-PE")} por minuto</p></div>{plan.id.startsWith("custom_") && <button type="button" onClick={() => void removeCustomPlan(plan.id)} className="text-xs font-semibold text-rose-300">Eliminar</button>}</div>)}</div>
      </section>

      <section className="rounded-2xl border border-line bg-surface/80 p-4 sm:p-5">
        <div className="flex items-center justify-between gap-3">
          <div><h2 className="text-lg font-bold">Registro de acciones administrativas</h2><p className="mt-1 text-sm text-muted">Últimos cambios realizados desde el panel.</p></div>
          <button type="button" onClick={() => void getAdminAudit().then(setAudit).catch(() => toast("No se pudo cargar la auditoría.", "error"))} className="rounded-lg border border-line px-3 py-2 text-xs font-semibold text-muted hover:bg-surface2">Actualizar</button>
        </div>
        {audit.length ? <ul className="mt-4 space-y-2">{audit.map((item, i) => <li key={i} className="rounded-lg border border-line/70 bg-bg/50 p-3 text-sm"><div className="flex flex-wrap justify-between gap-2"><strong>{item.action}</strong><span className="text-xs text-muted">{new Date(item.at).toLocaleString("es-PE")}</span></div><p className="mt-1 text-muted">{item.detail}</p><p className="mt-1 text-xs text-muted">Operador: {item.actor} · Usuario: {item.target}</p></li>)}</ul> : <p className="mt-4 text-sm text-muted">Todavía no hay acciones administrativas registradas.</p>}
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
