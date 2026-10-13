import { requireAdmin } from "../_lib/auth.js";
import { errorMessage, json, readJson, requireSameOrigin } from "../_lib/http.js";
import { putBase64File } from "../_lib/github.js";

const MAX_IMAGE_BYTES = 2 * 1024 * 1024;
const ALLOWED_TYPES = {
  "image/jpeg": "jpg",
  "image/png": "png",
  "image/webp": "webp",
  "image/gif": "gif"
};

export async function onRequestPost({ request, env }) {
  const originError = requireSameOrigin(request);
  if (originError) return originError;
  const authError = await requireAdmin(request, env);
  if (authError) return authError;

  try {
    const body = await readJson(request, 3 * 1024 * 1024);
    const extension = ALLOWED_TYPES[body.type];
    if (!extension || typeof body.name !== "string" || typeof body.content !== "string" ||
        !/^[A-Za-z0-9+/]+={0,2}$/.test(body.content)) {
      return json({ error: "Format de photo invalide (JPEG, PNG, WebP ou GIF attendu)" }, 400);
    }
    const byteLength = Math.floor(body.content.length * 3 / 4) -
      (body.content.endsWith("==") ? 2 : body.content.endsWith("=") ? 1 : 0);
    if (!byteLength || byteLength > MAX_IMAGE_BYTES) {
      return json({ error: "La photo doit peser au maximum 2 Mo" }, 413);
    }
    const firstBytes = Uint8Array.from(atob(body.content), (character) => character.charCodeAt(0));
    const signatures = {
      "image/jpeg": firstBytes[0] === 0xff && firstBytes[1] === 0xd8 && firstBytes[2] === 0xff,
      "image/png": firstBytes[0] === 0x89 && firstBytes[1] === 0x50 && firstBytes[2] === 0x4e && firstBytes[3] === 0x47,
      "image/gif": firstBytes[0] === 0x47 && firstBytes[1] === 0x49 && firstBytes[2] === 0x46,
      "image/webp": firstBytes[0] === 0x52 && firstBytes[1] === 0x49 && firstBytes[2] === 0x46 && firstBytes[3] === 0x46
    };
    if (!signatures[body.type]) return json({ error: "Le contenu ne correspond pas au format de photo annoncé" }, 400);
    const name = body.name.normalize("NFD").replace(/[\u0300-\u036f]/g, "")
      .toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "").slice(0, 50) || "photo";
    const path = `assets/img/catalog-${name}-${crypto.randomUUID()}.${extension}`;
    const saved = await putBase64File(env, path, body.content, `Add product image ${name}`);
    return json({ ok: true, path, commit: saved.commit });
  } catch (error) {
    return json({ error: errorMessage(error) }, 502);
  }
}
