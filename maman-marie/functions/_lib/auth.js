import { json } from "./http.js";

const COOKIE_NAME = "__Host-maman-tokpa-admin";
const SESSION_SECONDS = 8 * 60 * 60;
const encoder = new TextEncoder();

function base64UrlEncode(bytes) {
  let binary = "";
  bytes.forEach((byte) => { binary += String.fromCharCode(byte); });
  return btoa(binary).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/g, "");
}

function base64UrlDecode(value) {
  const normalized = value.replace(/-/g, "+").replace(/_/g, "/");
  const binary = atob(normalized + "=".repeat((4 - normalized.length % 4) % 4));
  return Uint8Array.from(binary, (character) => character.charCodeAt(0));
}

async function hmacKey(secret) {
  return crypto.subtle.importKey(
    "raw",
    encoder.encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign", "verify"]
  );
}

function cookieValue(request) {
  const cookies = request.headers.get("Cookie") || "";
  const entry = cookies.split(";").map((item) => item.trim())
    .find((item) => item.startsWith(COOKIE_NAME + "="));
  return entry ? entry.slice(COOKIE_NAME.length + 1) : "";
}

export function cookieHeader(value, maxAge = SESSION_SECONDS) {
  return `${COOKIE_NAME}=${value}; Path=/; Max-Age=${maxAge}; HttpOnly; Secure; SameSite=Strict`;
}

export async function createSession(secret) {
  const payload = base64UrlEncode(encoder.encode(JSON.stringify({
    exp: Math.floor(Date.now() / 1000) + SESSION_SECONDS
  })));
  const signature = await crypto.subtle.sign("HMAC", await hmacKey(secret), encoder.encode(payload));
  return `${payload}.${base64UrlEncode(new Uint8Array(signature))}`;
}

export async function hasAdminSession(request, secret) {
  if (!secret || secret.length < 32) return false;
  const [payload, signature, extra] = cookieValue(request).split(".");
  if (!payload || !signature || extra) return false;
  try {
    const valid = await crypto.subtle.verify(
      "HMAC",
      await hmacKey(secret),
      base64UrlDecode(signature),
      encoder.encode(payload)
    );
    if (!valid) return false;
    const session = JSON.parse(new TextDecoder().decode(base64UrlDecode(payload)));
    return Number.isInteger(session.exp) && session.exp > Math.floor(Date.now() / 1000);
  } catch {
    return false;
  }
}

export async function requireAdmin(request, env) {
  if (!await hasAdminSession(request, env.SESSION_SECRET || "")) {
    return json({ error: "Connexion administrateur requise" }, 401);
  }
  return null;
}

export function clearSessionHeader() {
  return cookieHeader("", 0);
}
