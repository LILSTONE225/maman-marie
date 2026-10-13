const API_ROOT = "https://api.github.com";
const API_VERSION = "2022-11-28";

function repoConfig(env) {
  if (!env.GITHUB_TOKEN || !env.GITHUB_OWNER || !env.GITHUB_REPO || !env.GITHUB_BRANCH) {
    throw new Error("GitHub backend variables are not configured");
  }
  return env;
}

function contentsUrl(env, path, ref) {
  const config = repoConfig(env);
  const directory = (config.GITHUB_PROJECT_DIR || "").replace(/^\/+|\/+$/g, "");
  const repositoryPath = directory ? `${directory}/${path}` : path;
  const url = `${API_ROOT}/repos/${encodeURIComponent(config.GITHUB_OWNER)}/${encodeURIComponent(config.GITHUB_REPO)}/contents/${repositoryPath}`;
  return ref ? `${url}?ref=${encodeURIComponent(ref)}` : url;
}

async function githubRequest(env, path, options = {}, ref) {
  const response = await fetch(contentsUrl(env, path, ref), {
    ...options,
    headers: {
      Accept: "application/vnd.github+json",
      Authorization: `Bearer ${env.GITHUB_TOKEN}`,
      "X-GitHub-Api-Version": API_VERSION,
      "Content-Type": "application/json",
      ...(options.headers || {})
    }
  });
  if (response.status === 404) return { response, data: null };
  const data = await response.json().catch(() => null);
  if (!response.ok) {
    let detail = data && data.message ? data.message : `GitHub API returned ${response.status}`;
    if (response.status === 401 || response.status === 403) {
      detail += ". Vérifiez le secret GITHUB_TOKEN dans Cloudflare : token actif, dépôt LILSTONE225/maman-marie autorisé et permission Contents en lecture et écriture.";
    }
    throw new Error(detail);
  }
  return { response, data };
}

function decodeContents(content) {
  const binary = atob(content.replace(/\s/g, ""));
  const bytes = Uint8Array.from(binary, (character) => character.charCodeAt(0));
  return new TextDecoder().decode(bytes);
}

function encodeContents(content) {
  const bytes = new TextEncoder().encode(content);
  let binary = "";
  bytes.forEach((byte) => { binary += String.fromCharCode(byte); });
  return btoa(binary);
}

export async function getFile(env, path) {
  const { data } = await githubRequest(env, path, { method: "GET" }, repoConfig(env).GITHUB_BRANCH);
  if (!data || data.encoding !== "base64" || typeof data.content !== "string") {
    throw new Error(`Cannot read ${path} from the configured GitHub branch`);
  }
  return { content: decodeContents(data.content), sha: data.sha };
}

export async function putFile(env, path, content, message) {
  return putEncodedFile(env, path, encodeContents(content), message);
}

export async function putBase64File(env, path, content, message) {
  return putEncodedFile(env, path, content, message);
}

async function putEncodedFile(env, path, content, message) {
  let sha;
  try {
    sha = (await getFile(env, path)).sha;
  } catch (error) {
    if (!/Cannot read /.test(error.message)) throw error;
  }
  const body = {
    message,
    content,
    branch: repoConfig(env).GITHUB_BRANCH
  };
  if (sha) body.sha = sha;
  const { data } = await githubRequest(env, path, {
    method: "PUT",
    body: JSON.stringify(body)
  });
  if (!data || !data.commit || !data.commit.sha) throw new Error("GitHub did not confirm the commit");
  return { commit: data.commit.sha, url: data.commit.html_url };
}
