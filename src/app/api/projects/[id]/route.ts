import { AppError } from "@/server/errors";
import { json, readJson, requireUser, route } from "@/server/http";
import { deleteProject, getProject, saveProject } from "@/server/projects";

export const runtime = "nodejs";

type P = { id: string };

export const GET = route<P>(async ({ d, req }, { id }) => {
  const { user } = await requireUser(d, req);
  const project = await getProject(d, user.uid, id);
  if (!project) throw new AppError(404, "Proyecto no encontrado.");
  return json({ project });
});

export const PUT = route<P>(async ({ d, req }, { id }) => {
  const { user } = await requireUser(d, req);
  await saveProject(d, user.uid, id, await readJson(req, 800_000));
  return json({ id });
});

export const DELETE = route<P>(async ({ d, req }, { id }) => {
  const { user } = await requireUser(d, req);
  await deleteProject(d, user.uid, id);
  return json({ ok: true });
});
