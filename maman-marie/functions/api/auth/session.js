import { hasAdminSession } from "../../_lib/auth.js";
import { json } from "../../_lib/http.js";

export async function onRequestGet({ request, env }) {
  return json({ authenticated: await hasAdminSession(request, env.SESSION_SECRET || "") });
}
