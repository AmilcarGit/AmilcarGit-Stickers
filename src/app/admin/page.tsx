"use client";

import { useCallback, useEffect, useState } from "react";
import { RequireAdmin } from "@/components/Guards";
import { useToast } from "@/components/Providers";
import { listUsers, setUserPlan } from "@/lib/data";
import type { UserRow } from "@/lib/types";

function AdminInner() {
  const toast = useToast();
  const [users, setUsers] = useState<UserRow[]>([]);
  const [total, setTotal] = useState(0);

  const loadUsers = useCallback(async (offset: number) => {
    try {
      const page = await listUsers(offset);
      setTotal(page.total);
      setUsers((prev) => (offset === 0 ? page.users : [...prev, ...page.users]));
    } catch {
      toast("No se pudo cargar el registro de usuarios.", "error");
    }
  }, [toast]);

  async function changePlan(u: UserRow, plan: UserRow["plan"]) {
    try {
      await setUserPlan(u.uid, plan);
      setUsers((list) => list.map((x) => (x.uid === u.uid ? { ...x, plan } : x)));
      toast(`Plan de @${u.username}: ${plan}.`, "ok");
    } catch (err) {
      toast(err instanceof Error ? err.message : "No se pudo cambiar el plan.", "error");
    }
  }

  useEffect(() => {
    void loadUsers(0);
  }, [loadUsers]);

  return (
    <div className="space-y-6">
      <h1 className="text-3xl font-bold">Administración</h1>
      <p className="text-muted">Usuarios registrados y planes de la API.</p>

      <section aria-labelledby="usuarios" className="space-y-3">
        <h2 id="usuarios" className="text-xl font-bold">
          Usuarios registrados ({total})
        </h2>
        <div className="card overflow-x-auto !p-0">
          <table className="w-full text-left text-sm">
            <thead className="border-b border-line text-muted">
              <tr>
                <th scope="col" className="p-3">Usuario</th>
                <th scope="col" className="p-3">Correo</th>
                <th scope="col" className="p-3">Verificado</th>
                <th scope="col" className="p-3">Plan API</th>
                <th scope="col" className="p-3">Alta</th>
              </tr>
            </thead>
            <tbody>
              {users.map((u) => (
                <tr key={u.uid} className="border-b border-line/50 last:border-0">
                  <td className="p-3">
                    <span className="font-medium">@{u.username}</span>
                  </td>
                  <td className="p-3">{u.email}</td>
                  <td className="p-3">{u.emailVerified ? "Sí" : "No"}</td>
                  <td className="p-3">
                    <label className="sr-only" htmlFor={`plan-${u.uid}`}>
                      Plan de @{u.username}
                    </label>
                    <select id={`plan-${u.uid}`} className="input !min-h-[36px] !py-1" value={u.plan} onChange={(e) => changePlan(u, e.target.value as UserRow["plan"])}>
                      <option value="free">free</option>
                      <option value="pro">pro</option>
                      <option value="ultra">ultra</option>
                    </select>
                  </td>
                  <td className="p-3">{new Date(u.createdAt).toLocaleDateString("es")}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        {users.length < total && (
          <button type="button" className="btn-ghost" onClick={() => loadUsers(users.length)}>
            Ver más
          </button>
        )}
      </section>
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
