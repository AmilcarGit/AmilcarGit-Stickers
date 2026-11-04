"use client";

import { useEffect, useState } from "react";

type InstallEvent = Event & { prompt: () => Promise<void>; userChoice: Promise<{ outcome: "accepted" | "dismissed" }> };

/** Botón «Instalar app»: solo aparece cuando el navegador (Chrome/Edge/Android) ofrece instalar la web como app. */
export function InstallButton() {
  const [evt, setEvt] = useState<InstallEvent | null>(null);

  useEffect(() => {
    const onPrompt = (e: Event) => {
      e.preventDefault();
      setEvt(e as InstallEvent);
    };
    const onInstalled = () => setEvt(null);
    window.addEventListener("beforeinstallprompt", onPrompt);
    window.addEventListener("appinstalled", onInstalled);
    return () => {
      window.removeEventListener("beforeinstallprompt", onPrompt);
      window.removeEventListener("appinstalled", onInstalled);
    };
  }, []);

  if (!evt) return null;
  return (
    <button
      type="button"
      className="btn-ghost !min-h-[40px]"
      onClick={async () => {
        await evt.prompt();
        await evt.userChoice.catch(() => undefined);
        setEvt(null);
      }}
    >
      📲 Instalar app
    </button>
  );
}
