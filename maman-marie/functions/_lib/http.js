export function json(data, status = 200, headers = {}) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { "content-type": "application/json; charset=utf-8", "cache-control": "no-store", ...headers }
  });
}

export function errorMessage(error) {
  return error instanceof Error ? error.message : "Unexpected server error";
}

export async function readJson(request, maxBytes = 16 * 1024) {
  try {
    const body = await request.text();
    if (new TextEncoder().encode(body).byteLength > maxBytes) {
      throw new Error("Request body is too large");
    }
    return JSON.parse(body);
  } catch {
    throw new Error("Request body must be valid JSON and within the allowed size");
  }
}

export function requireSameOrigin(request) {
  const origin = request.headers.get("Origin");
  if (!origin || origin !== new URL(request.url).origin) {
    return json({ error: "Cross-origin request denied" }, 403);
  }
  return null;
}
