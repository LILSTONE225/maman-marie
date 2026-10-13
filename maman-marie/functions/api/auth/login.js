import { cookieHeader, createSession } from "../../_lib/auth.js";
import { json, readJson, requireSameOrigin } from "../../_lib/http.js";

async function digest(value) {
  return new Uint8Array(await crypto.subtle.digest("SHA-256", new TextEncoder().encode(value)));
}

function equalBytes(left, right) {
  if (left.length !== right.length) return false;
  let difference = 0;
  for (let index = 0; index < left.length; index++) difference |= left[index] ^ right[index];
  return difference === 0;
}

export async function onRequestPost({ request, env }) {
  const originError = requireSameOrigin(request);
  if (originError) return originError;
  if (!env.ADMIN_PASSWORD || env.ADMIN_PASSWORD.length < 16 ||
      !env.SESSION_SECRET || env.SESSION_SECRET.length < 32) {
    return json({ error: "Configure an admin password of at least 16 characters and a session secret of at least 32 characters" }, 503);
  }
  try {
    const body = await readJson(request, 1024);
    if (typeof body.password !== "string" || body.password.length > 256 ||
        !equalBytes(await digest(body.password), await digest(env.ADMIN_PASSWORD))) {
      return json({ error: "Mot de passe incorrect" }, 401);
    }
    const session = await createSession(env.SESSION_SECRET);
    return json({ ok: true }, 200, { "Set-Cookie": cookieHeader(session) });
  } catch (error) {
    return json({ error: error.message }, 400);
  }
}
