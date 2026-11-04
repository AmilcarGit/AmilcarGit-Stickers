import { json, readJson, requireUser, route } from "@/server/http";
import { listProjects, saveProject } from "@/server/projects";

export const runtime = "nodejs";

export const GET = route(async ({ d, req }) => {
  const { user } = await requireUser(d, req);
  return json({ projects: await listProjects(d, user.uid) });
});

export const POST = route(async ({ d, req }) => {
  const { user } = await requireUser(d, req);
  const id = await saveProject(d, user.uid, null, await readJson(req, 800_000));
  return json({ id }, 201);
});
