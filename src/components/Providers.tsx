"use client";

import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { fetchMe, logoutUser } from "@/lib/data";
import type { MeInfo } from "@/lib/types";

/* ------------------------------- Sesión ------------------------------- */

type AuthState = {
  /** Cuenta con sesión iniciada (null si no hay sesión). Incluye perfil, correo y si es moderadora. */
  user: MeInfo | null;
  admin: boolean;
  loading: boolean;
  /** Vuelve a pedir la cuenta al servidor (tras verificar el correo, editar el perfil…). */
  refresh: () => Promise<void>;
  /** Usa directamente una cuenta ya recibida (tras iniciar sesión o registrarse). */
  setUser: (me: MeInfo | null) => void;
  logout: () => Promise<void>;
};

const AuthContext = createContext<AuthState | null>(null);

export function useAuth(): AuthState {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth debe usarse dentro de <Providers>.");
  return ctx;
}

/* ------------------------------- Avisos ------------------------------- */

type ToastKind = "ok" | "error" | "info";
type ToastItem = { id: number; message: string; kind: ToastKind };
const ToastContext = createContext<(message: string, kind?: ToastKind) => void>(() => undefined);

export const useToast = () => useContext(ToastContext);

export function Providers({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<MeInfo | null>(null);
  const [loading, setLoading] = useState(true);
  const [toasts, setToasts] = useState<ToastItem[]>([]);
  const nextId = useRef(1);

  const toast = useCallback((message: string, kind: ToastKind = "info") => {
    const id = nextId.current++;
    setToasts((t) => [...t, { id, message, kind }]);
    setTimeout(() => setToasts((t) => t.filter((x) => x.id !== id)), 4500);
  }, []);

  const refresh = useCallback(async () => {
    try {
      setUser(await fetchMe());
    } catch {
      setUser(null);
    }
  }, []);

  useEffect(() => {
    void refresh().finally(() => setLoading(false));
  }, [refresh]);

  const logout = useCallback(async () => {
    await logoutUser();
    setUser(null);
  }, []);

  const value = useMemo<AuthState>(() => ({ user, admin: user?.admin === true, loading, refresh, setUser, logout }), [user, loading, refresh, logout]);

  return (
    <AuthContext.Provider value={value}>
      <ToastContext.Provider value={toast}>
        {children}
        <div aria-live="polite" className="pointer-events-none fixed inset-x-0 bottom-4 z-50 flex flex-col items-center gap-2 px-4">
          {toasts.map((t) => (
            <div
              key={t.id}
              role="status"
              className={`pointer-events-auto max-w-md rounded-xl border px-4 py-3 text-sm shadow-lg backdrop-blur ${
                t.kind === "error"
                  ? "border-danger/60 bg-surface text-danger"
                  : t.kind === "ok"
                    ? "border-ok/60 bg-surface text-ok"
                    : "border-line bg-surface text-ink"
              }`}
            >
              {t.message}
            </div>
          ))}
        </div>
      </ToastContext.Provider>
    </AuthContext.Provider>
  );
}
