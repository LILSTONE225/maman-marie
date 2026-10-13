import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { after, test } from "node:test";
import { onRequestPost as login } from "../functions/api/auth/login.js";
import { onRequestGet as session } from "../functions/api/auth/session.js";
import { onRequestGet as getCatalog, onRequestPut as putCatalog } from "../functions/api/catalog.js";
import { onRequestPost as logout } from "../functions/api/auth/logout.js";
import { onRequestPost as uploadImage } from "../functions/api/images.js";

const originalFetch = globalThis.fetch;
after(() => { globalThis.fetch = originalFetch; });

test("protects catalogue commits and image uploads behind the admin session", async () => {
  let catalogue = await readFile(new URL("../data/catalog.json", import.meta.url), "utf8");
  const writes = [];
  globalThis.fetch = async (url, options = {}) => {
    const repositoryPath = decodeURIComponent(new URL(url).pathname.split("/contents/")[1] || "");
    const path = repositoryPath.replace(/^maman-marie\//, "");
    if (options.method === "PUT") {
      const body = JSON.parse(options.body);
      writes.push({ path, body });
      if (path === "data/catalog.json") {
        catalogue = Buffer.from(body.content, "base64").toString("utf8");
      }
      return new Response(JSON.stringify({
        commit: { sha: "test-commit", html_url: "https://github.com/LILSTONE225/maman-marie/commit/test-commit" }
      }), { status: 200 });
    }
    if (path.startsWith("assets/img/")) return new Response("{}", { status: 404 });
    return new Response(JSON.stringify({
      encoding: "base64",
      content: Buffer.from(catalogue).toString("base64"),
      sha: "existing-sha"
    }), { status: 200 });
  };

  const env = {
    ADMIN_PASSWORD: "test-admin-password-at-least-16",
    SESSION_SECRET: "test-session-secret-that-is-at-least-32-characters",
    GITHUB_TOKEN: "test-only-token",
    GITHUB_OWNER: "LILSTONE225",
    GITHUB_REPO: "maman-marie",
    GITHUB_PROJECT_DIR: "maman-marie",
    GITHUB_BRANCH: "main"
  };
  const origin = "https://maman-tokpa.pages.dev";
  const request = (path, method, body, cookie, requestOrigin = origin) => new Request(origin + path, {
    method,
    headers: {
      Origin: requestOrigin,
      "Content-Type": "application/json",
      ...(cookie ? { Cookie: cookie } : {})
    },
    ...(body === undefined ? {} : { body: JSON.stringify(body) })
  });

  const badPassword = await login({
    request: request("/api/auth/login", "POST", { password: "incorrect" }),
    env
  });
  assert.equal(badPassword.status, 401);

  const crossOrigin = await login({
    request: request("/api/auth/login", "POST", { password: env.ADMIN_PASSWORD }, undefined, "https://attacker.example"),
    env
  });
  assert.equal(crossOrigin.status, 403);

  const unauthorizedWrite = await putCatalog({
    request: request("/api/catalog", "PUT", JSON.parse(catalogue)),
    env
  });
  assert.equal(unauthorizedWrite.status, 401);

  const signedIn = await login({
    request: request("/api/auth/login", "POST", { password: env.ADMIN_PASSWORD }),
    env
  });
  assert.equal(signedIn.status, 200);
  const cookie = signedIn.headers.get("set-cookie").split(";")[0];
  assert.match(signedIn.headers.get("set-cookie"), /HttpOnly; Secure; SameSite=Strict/);

  const activeSession = await session({ request: request("/api/auth/session", "GET", undefined, cookie), env });
  assert.equal((await activeSession.json()).authenticated, true);

  const updated = JSON.parse(catalogue);
  updated.products[0].desc = "Description mise à jour par la cliente";
  const saved = await putCatalog({
    request: request("/api/catalog", "PUT", updated, cookie),
    env
  });
  assert.equal(saved.status, 200);
  assert.equal(writes.at(-1).path, "data/catalog.json");
  assert.equal(JSON.parse(Buffer.from(writes.at(-1).body.content, "base64").toString("utf8"))
    .products[0].desc, updated.products[0].desc);
  const publicCatalog = await getCatalog({ env });
  assert.equal((await publicCatalog.json()).products[0].desc, updated.products[0].desc);

  const jpeg = Buffer.from([0xff, 0xd8, 0xff, 0x00]);
  const uploaded = await uploadImage({
    request: request("/api/images", "POST", {
      name: "photo test",
      type: "image/jpeg",
      content: jpeg.toString("base64")
    }, cookie),
    env
  });
  assert.equal(uploaded.status, 200);
  const result = await uploaded.json();
  assert.match(result.path, /^assets\/img\/catalog-photo-test-/);
  assert.equal(Buffer.from(writes.at(-1).body.content, "base64").toString("hex"), jpeg.toString("hex"));

  const signedOut = await logout({ request: request("/api/auth/logout", "POST"), env });
  assert.equal(signedOut.status, 200);
  assert.match(signedOut.headers.get("set-cookie"), /Max-Age=0/);
});
