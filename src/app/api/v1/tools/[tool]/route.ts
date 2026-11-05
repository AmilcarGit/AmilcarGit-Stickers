import QRCode from "qrcode";
import { AppError } from "@/server/errors";
import { base64, hashText, password, textParam, uuids } from "@/server/tools";
import { preflight, v1With } from "@/server/v1";

export const runtime = "nodejs";
export const OPTIONS = preflight;

const TOOLS = ["qr", "hash", "uuid", "base64", "password"] as const;

/** Herramientas: qr (PNG), hash, uuid, base64, password. */
export const GET = v1With<{ tool: string }>(async ({ url }, { tool }) => {
  const sp = url.searchParams;
  switch (tool) {
    case "qr": {
      const text = textParam(sp.get("text"));
      const size = Math.min(1024, Math.max(128, Number.parseInt(sp.get("size") ?? "", 10) || 400));
      const png = await QRCode.toBuffer(text, { width: size, margin: 2, type: "png" });
      return new Response(new Uint8Array(png) as unknown as BodyInit, { headers: { "content-type": "image/png" } });
    }
    case "hash":
      return hashText(textParam(sp.get("text")), sp.get("algo") ?? "sha256");
    case "uuid":
      return { uuids: uuids(Number.parseInt(sp.get("count") ?? "1", 10)) };
    case "base64":
      return { result: base64(textParam(sp.get("text")), sp.get("mode") ?? "encode") };
    case "password":
      return { password: password(Number.parseInt(sp.get("length") ?? "16", 10), sp.get("symbols") !== "false") };
    default:
      throw new AppError(404, `Herramienta desconocida. Usa: ${TOOLS.join(", ")}.`);
  }
});
