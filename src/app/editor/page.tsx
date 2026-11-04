"use client";

import { Suspense } from "react";
import { RequireAuth, VerifyBanner } from "@/components/Guards";
import { StickerEditor } from "@/components/StickerEditor";

export default function EditorPage() {
  return (
    <RequireAuth>
      <h1 className="sr-only">Editor de stickers</h1>
      <VerifyBanner />
      <Suspense fallback={<p className="text-muted">Cargando editor…</p>}>
        <StickerEditor />
      </Suspense>
    </RequireAuth>
  );
}
