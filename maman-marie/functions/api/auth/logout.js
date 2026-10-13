import { clearSessionHeader } from "../../_lib/auth.js";
import { json, requireSameOrigin } from "../../_lib/http.js";

export function onRequestPost({ request }) {
  const originError = requireSameOrigin(request);
  if (originError) return originError;
  return json({ ok: true }, 200, { "Set-Cookie": clearSessionHeader() });
}
