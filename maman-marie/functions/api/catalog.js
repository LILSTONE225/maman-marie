import { requireAdmin } from "../_lib/auth.js";
import { errorMessage, json, readJson, requireSameOrigin } from "../_lib/http.js";
import { getFile, putFile } from "../_lib/github.js";

const CATALOG_PATH = "data/catalog.json";
const CATEGORIES = new Set(["croustillant", "graines", "maison"]);
const ID_PATTERN = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;

function validImage(image) {
  return image === null ||
    (typeof image === "string" && image.length <= 255 && /^assets\/img\/[A-Za-z0-9._-]+$/.test(image));
}

function validPrice(price) {
  return price === null || (Number.isSafeInteger(price) && price >= 0);
}

function validProduct(product) {
  if (!product || typeof product !== "object" ||
      typeof product.id !== "string" || !ID_PATTERN.test(product.id) ||
      typeof product.name !== "string" || product.name.length < 1 || product.name.length > 120 ||
      !CATEGORIES.has(product.cat) ||
      typeof product.desc !== "string" || product.desc.length > 1000 ||
      !(product.offer === undefined || (typeof product.offer === "string" && product.offer.length <= 500)) ||
      !validPrice(product.price) ||
      !(product.unit === null || (typeof product.unit === "string" && product.unit.length <= 40)) ||
      !validImage(product.image) ||
      !(product.available === undefined || typeof product.available === "boolean")) return false;
  if (product.variants === undefined) return true;
  if (!Array.isArray(product.variants) || product.variants.length > 25) return false;
  const variantIds = new Set();
  return product.variants.every((variant) => {
    if (!variant || typeof variant !== "object" ||
        typeof variant.id !== "string" || !ID_PATTERN.test(variant.id) || variantIds.has(variant.id) ||
        typeof variant.name !== "string" || variant.name.length < 1 || variant.name.length > 120 ||
        !(variant.recipe === null || variant.recipe === undefined || (typeof variant.recipe === "string" && variant.recipe.length <= 120)) ||
        !Number.isSafeInteger(variant.retailPrice) || variant.retailPrice < 0 ||
        !(variant.retailUnit === null || variant.retailUnit === undefined || (typeof variant.retailUnit === "string" && variant.retailUnit.length <= 40)) ||
        !validImage(variant.image) ||
        !(variant.available === undefined || typeof variant.available === "boolean")) return false;
    variantIds.add(variant.id);
    return true;
  });
}

function validCatalog(content) {
  if (!content || !Array.isArray(content.products) || content.products.length > 100 ||
      !/^\d{8,15}$/.test(content.phoneCall || "") ||
      !/^\d{8,15}$/.test(content.phoneWhatsapp || "")) return false;
  const ids = new Set();
  return content.products.every((product) => {
    if (!validProduct(product) || ids.has(product.id)) return false;
    ids.add(product.id);
    return true;
  });
}

export async function onRequestGet({ env }) {
  try {
    const file = await getFile(env, CATALOG_PATH);
    return json(JSON.parse(file.content));
  } catch (error) {
    return json({ error: errorMessage(error) }, 502);
  }
}

export async function onRequestPut({ request, env }) {
  const originError = requireSameOrigin(request);
  if (originError) return originError;
  const authError = await requireAdmin(request, env);
  if (authError) return authError;

  try {
    const content = await readJson(request, 256 * 1024);
    if (!validCatalog(content)) {
      return json({ error: "Le catalogue ou les coordonnées sont invalides" }, 400);
    }
    const saved = await putFile(env, CATALOG_PATH, JSON.stringify(content, null, 2) + "\n",
      "Update product catalog from admin");
    return json({ ok: true, commit: saved.commit, url: saved.url });
  } catch (error) {
    return json({ error: errorMessage(error) }, 502);
  }
}
