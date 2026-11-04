import { json, route } from "@/server/http";
import { hit } from "@/server/store";
import { AppError } from "@/server/errors";
import { usernameAvailable } from "@/server/users";

export const runtime = "nodejs";

export const GET = route(async ({ d, req, ip }) => {
  if (!(await hit(d.store, `rl:uname:${ip}`, 60, 600))) throw new AppError(429, "Demasiadas consultas. Espera un momento.");
  const name = new URL(req.url).searchParams.get("name") ?? "";
  return json({ available: await usernameAvailable(d, name) });
});
