"use client";

import { onAuthStateChanged, reload, type User } from "firebase/auth";
import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { getProfile, isAdmin as checkAdmin } from "@/lib/data";
import { auth, firebaseConfigured } from "@/lib/firebase";
import type { UserProfile } from "@/lib/types";

/* ------------------------------- Sesión ------------------------------- */

type AuthState = {
  user: User | null;
  profile: UserProfile | null;
  admin: boolean;
  loading: boolean;
  configured: boolean;
  refreshProfile: () => Promise<void>;
  reloadUser: () => Promise<void>;
  getToken: () => Promise<string>;
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
  const [user, setUser] = useState<User | null>(null);
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [admin, setAdmin] = useState(false);
  const [loading, setLoading] = useState(firebaseConfigured);
  const [toasts, setToasts] = useState<ToastItem[]>([]);
  const nextId = useRef(1);

  const toast = useCallback((message: string, kind: ToastKind = "info") => {
    const id = nextId.current++;
    setToasts((t) => [...t, { id, message, kind }]);
    setTimeout(() => setToasts((t) => t.filter((x) => x.id !== id)), 4500);
  }, []);

  const loadProfile = useCallback(async (u: User | null) => {
    if (!u) {
      setProfile(null);
      setAdmin(false);
      return;
    }
    try {
      const [p, a] = await Promise.all([getProfile(u.uid), checkAdmin(u.uid)]);
      setProfile(p);
      setAdmin(a);
    } catch {
      setProfile(null);
      setAdmin(false);
    }
  }, []);

  useEffect(() => {
    if (!firebaseConfigured) return;
    return onAuthStateChanged(auth(), (u) => {
      setUser(u);
      void loadProfile(u).finally(() => setLoading(false));
    });
  }, [loadProfile]);

  const value = useMemo<AuthState>(
    () => ({
      user,
      profile,
      admin,
      loading,
      configured: firebaseConfigured,
      refreshProfile: () => loadProfile(user),
      reloadUser: async () => {
        const u = auth().currentUser;
        if (u) {
          await reload(u);
          setUser(auth().currentUser);
          // Se refresca el token para que las reglas vean email_verified = true.
          await auth().currentUser?.getIdToken(true);
        }
      },
      getToken: async () => {
        const u = auth().currentUser;
        if (!u) throw new Error("Inicia sesión para continuar.");
        return u.getIdToken();
      },
    }),
    [user, profile, admin, loading, loadProfile],
  );

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
