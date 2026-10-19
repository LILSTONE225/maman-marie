(function () {
  "use strict";
  var env = window.MM_ENV || {};
  var root = document.getElementById("app");
  var statusEl = document.getElementById("status");
  var historyEl = document.getElementById("history");
  var BUCKET = "site-images", MAX_BYTES = 2 * 1024 * 1024;
  var TYPES = { "image/jpeg": "jpg", "image/png": "png", "image/webp": "webp" };
  var CATS = [["croustillant", "Croustillant"], ["graines", "Graines"], ["maison", "Maison"]];
  var IMG_RE = /^(assets\/img\/[\w.-]+|https:\/\/[a-z0-9-]+\.supabase\.co\/storage\/v1\/object\/public\/site-images\/[\w\/.-]+)$/i;
  var sb = null, cfg = null, dirty = false, busy = false, timer = null, defaults = null, tab = "catalogue", legalSig = {};
  var TABS = [["catalogue", "Catalogue"], ["textes", "Textes"], ["sections", "Sections et apparence"], ["images", "Images"], ["contacts", "Contacts"], ["legal", "Légal"]];
  var SEC_LABELS = { accueil: "Accueil", ruban: "Ruban de produits", selection: "Sélection (carrousel)", collations: "Nos collations", univers: "Notre univers", contact: "Contact" };
  var THEME_DEFAULTS = { orange: "#ff5a1f", yellow: "#ffd43b", cocoa: "#24160f", cream: "#fff4d6", orangeDark: "#e04a12" };
  var THEME_LABELS = { orange: "Orange", yellow: "Jaune", cocoa: "Cacao", cream: "Crème", orangeDark: "Orange sombre" };

  function h(tag, attrs) {
    var e = document.createElement(tag);
    Object.keys(attrs || {}).forEach(function (k) {
      var v = attrs[k];
      if (k === "class") e.className = v;
      else if (k.slice(0, 2) === "on") e.addEventListener(k.slice(2), v);
      else if (v === true) e.setAttribute(k, "");
      else if (v !== false && v != null) e.setAttribute(k, v);
    });
    for (var i = 2; i < arguments.length; i++) {
      append(e, arguments[i]);
    }
    return e;
  }
  function append(parent, child) {
    if (child == null || child === false) return;
    if (Array.isArray(child)) {
      child.forEach(function (item) { append(parent, item); });
    } else {
      parent.appendChild(child.nodeType ? child : document.createTextNode(child));
    }
  }
  function say(msg, isErr) {
    statusEl.textContent = msg;
    statusEl.className = "show" + (isErr ? " err" : "");
    clearTimeout(timer);
    timer = setTimeout(function () { statusEl.className = ""; }, isErr ? 8000 : 4000);
  }
  function setDirty(v) {
    dirty = v;
    var b = document.getElementById("dirty");
    if (b) {
      b.textContent = v ? "Modifications non enregistrées — cliquez sur Enregistrer" : "Brouillon enregistré";
      b.className = "dirty" + (v ? " unsaved" : " saved");
    }
    var previewButton = document.getElementById("preview-button");
    var publishButton = document.getElementById("publish-button");
    if (previewButton) previewButton.disabled = v;
    if (publishButton) publishButton.disabled = v;
  }
  window.addEventListener("beforeunload", function (e) { if (dirty) { e.preventDefault(); e.returnValue = ""; } });

  /* ---------- Connexion ---------- */
  function showLogin(msg) {
    var err = h("p", { class: "errors", role: "alert", hidden: !msg }, msg || "");
    var email = h("input", { type: "email", id: "email", autocomplete: "username", required: true });
    var key = h("input", { type: "password", id: "key", autocomplete: "current-password", required: true });
    var btn = h("button", { type: "submit", class: "primary" }, "Se connecter");
    var form = h("form", { novalidate: true, onsubmit: function (ev) {
      ev.preventDefault();
      if (!email.value.trim() || !key.value) { err.hidden = false; err.textContent = "Renseignez l’identifiant et la clé."; return; }
      btn.disabled = true; btn.textContent = "Connexion…"; err.hidden = true;
      sb.auth.signInWithPassword({ email: email.value.trim(), password: key.value }).then(function (r) {
        key.value = "";
        if (r.error) {
          err.hidden = false;
          err.textContent = "Connexion refusée par Supabase : " + r.error.message;
          btn.disabled = false; btn.textContent = "Se connecter";
          return;
        }
        return sb.rpc("is_owner", {}).then(function (owner) {
          if (owner.error) throw new Error("Vérification du propriétaire impossible : " + owner.error.message);
          if (!owner.data) {
            return sb.auth.signOut().then(function () {
              err.hidden = false;
              err.textContent = "Compte connecté, mais non autorisé : ajoutez cet utilisateur à public.app_owner dans Supabase.";
              btn.disabled = false; btn.textContent = "Se connecter";
            });
          }
          return loadDraft();
        });
      }).catch(function (e) {
        return sb.auth.signOut().then(function () {
          err.hidden = false;
          err.textContent = e.message || "Erreur inattendue lors de la connexion.";
          btn.disabled = false; btn.textContent = "Se connecter";
        });
      });
    } },
      h("label", { for: "email" }, "Identifiant", email),
      h("label", { for: "key" }, "Clé secrète", key),
      err, btn);
    root.replaceChildren(h("main", {}, h("div", { class: "login" },
      h("h1", {}, "Espace propriétaire"), h("p", {}, "Les collations de Maman Tokpa"), form)));
  }

  /* ---------- Données ---------- */
  function loadDraft() {
    return sb.from("site_draft").select("data").eq("id", 1).maybeSingle().then(function (r) {
      if (r.error) throw new Error("Lecture du brouillon impossible : " + r.error.message);
      if (!r.data) throw new Error("Aucun brouillon trouvé dans public.site_draft. Exécutez le script seed.sql.");
      cfg = r.data.data; setDirty(false);
      legalSig = {}; (cfg.legal || []).forEach(function (l) { legalSig[l.slug] = sig(l); });
      return loadDefaults().then(render);
    });
  }
  function sig(l) { return [l.title, l.body, l.published].join("\u0000"); }
  function loadDefaults() {
    if (defaults) return Promise.resolve();
    return fetch("../index.html", { cache: "no-store" }).then(function (r) { if (!r.ok) throw new Error("defaults"); return r.text(); }).then(function (html) {
      var doc = new DOMParser().parseFromString(html, "text/html"), seen = {};
      defaults = { texts: [], images: [], sections: [] };
      doc.querySelectorAll("[data-c]").forEach(function (el) { defaults.texts.push({ key: el.getAttribute("data-c"), value: window.MMContent.toMarkup(el) }); });
      doc.querySelectorAll("[data-img]").forEach(function (el) { var k = el.getAttribute("data-img"); if (!seen[k]) { seen[k] = 1; defaults.images.push({ key: k, src: el.getAttribute("src") }); } });
      doc.querySelectorAll("[data-sec]").forEach(function (el) { defaults.sections.push({ key: el.getAttribute("data-sec") }); });
    });
  }
  function validate(c) {
    var errs = [], ids = {};
    var bad = function (s) { return /[<>]/.test(s || ""); };
    var price = function (v) { return v === null || (typeof v === "number" && isFinite(v) && v >= 0); };
    ["phoneCall", "phoneWhatsapp"].forEach(function (k) {
      if (!/^\d{8,15}$/.test(c[k] || "")) errs.push("Numéro « " + k + " » : chiffres uniquement, avec indicatif.");
    });
    c.products.forEach(function (p, i) {
      var n = "Produit " + (i + 1) + " (" + (p.name || "sans nom") + ")";
      if (!p.name || !p.name.trim()) errs.push(n + " : nom requis.");
      if (!/^[a-z0-9-]+$/.test(p.id || "")) errs.push(n + " : identifiant invalide (a-z, 0-9, tiret).");
      if (ids[p.id]) errs.push(n + " : identifiant en double.");
      ids[p.id] = 1;
      if (bad(p.name) || bad(p.desc)) errs.push(n + " : les caractères < et > sont interdits.");
      if (!price(p.price)) errs.push(n + " : prix invalide.");
      if (p.price !== null && !p.unit) errs.push(n + " : unité requise quand un prix est défini.");
      if (p.image && !IMG_RE.test(p.image)) errs.push(n + " : image non autorisée.");
      var vids = {};
      (p.variants || []).forEach(function (v, j) {
        var m = n + ", option " + (j + 1);
        if (!v.name || !v.name.trim()) errs.push(m + " : nom requis.");
        if (!/^[a-z0-9-]+$/.test(v.id || "")) errs.push(m + " : identifiant invalide.");
        if (vids[v.id]) errs.push(m + " : identifiant en double.");
        vids[v.id] = 1;
        if (bad(v.name)) errs.push(m + " : les caractères < et > sont interdits.");
        if (!price(v.retailPrice)) errs.push(m + " : prix invalide.");
        if (v.retailPrice !== null && !v.retailUnit) errs.push(m + " : unité requise.");
        if (v.image && !IMG_RE.test(v.image)) errs.push(m + " : image non autorisée.");
      });
    });
    Object.keys(c.texts || {}).forEach(function (k) { if (typeof c.texts[k] !== "string" || c.texts[k].length > 2000) errs.push("Texte « " + k + " » : 2000 caractères maximum."); });
    Object.keys(c.images || {}).forEach(function (k) { if (!window.MMContent.IMG_RE.test(c.images[k])) errs.push("Image « " + k + " » non autorisée."); });
    Object.keys(c.theme || {}).forEach(function (k) { if (!window.MMContent.HEX.test(c.theme[k])) errs.push("Couleur « " + k + " » invalide."); });
    var ls = {};
    (c.legal || []).forEach(function (l, i) {
      var n = "Légal " + (i + 1);
      if (!l.title || !l.title.trim()) errs.push(n + " : titre requis.");
      if (!/^[a-z0-9-]+$/.test(l.slug || "")) errs.push(n + " : identifiant invalide (a-z, 0-9, tiret).");
      if (ls[l.slug]) errs.push(n + " : identifiant en double.");
      ls[l.slug] = 1;
      if (l.published && !(l.body && l.body.trim())) errs.push(n + " : texte requis pour publier.");
    });
    return errs;
  }
  function run(label, fn) {
    if (busy) return Promise.resolve();
    busy = true;
    document.querySelectorAll(".bar button").forEach(function (b) { b.disabled = true; });
    return fn().catch(function (e) {
      var message = e && e.userMessage ? e.userMessage : e && e.message ? e.message : "Erreur inconnue.";
      if (e && e.code) message += " (code " + e.code + ")";
      if (e && e.details) message += " — " + e.details;
      if (e && e.hint) message += " " + e.hint;
      say(label + " : " + message, true);
      return false;
    }).then(function (ok) {
      busy = false;
      document.querySelectorAll(".bar button").forEach(function (b) { b.disabled = false; });
      return ok;
    });
  }
  function userError(msg) { var e = new Error(msg); e.userMessage = msg; return e; }
  function saveDraft() {
    var errs = validate(cfg);
    if (errs.length) { showErrors(errs); throw userError("Corrigez les erreurs avant d’enregistrer."); }
    showErrors([]);
    var now = new Date().toISOString();
    (cfg.legal || []).forEach(function (l) { if (legalSig[l.slug] !== sig(l)) l.updated = now; });
    return sb.from("site_draft").update({ data: cfg, updated_at: now }).eq("id", 1).select("id").maybeSingle().then(function (r) {
      if (r.error) throw r.error;
      if (!r.data) throw userError("Aucun brouillon n’a été modifié. Vérifiez que public.site_draft contient la ligne id = 1 et que votre compte est autorisé dans public.app_owner.");
      (cfg.legal || []).forEach(function (l) { legalSig[l.slug] = sig(l); });
      setDirty(false); return true;
    });
  }
  function showErrors(errs) {
    var box = document.getElementById("errors");
    if (!box) return;
    box.replaceChildren();
    box.hidden = !errs.length;
    if (errs.length) { box.appendChild(h("ul", {}, errs.map(function (e) { return h("li", {}, e); }))); box.focus(); }
  }
  function uploadImage(file) {
    if (!TYPES[file.type]) return Promise.reject(userError("Format refusé : JPEG, PNG ou WebP uniquement."));
    if (file.size > MAX_BYTES) return Promise.reject(userError("Image trop lourde (2 Mo maximum)."));
    var path = "products/" + crypto.randomUUID() + "." + TYPES[file.type];
    return sb.storage.from(BUCKET).upload(path, file, { contentType: file.type, upsert: false }).then(function (r) {
      if (r.error) throw userError("Téléversement échoué. L’ancienne image est conservée.");
      return sb.storage.from(BUCKET).getPublicUrl(path).data.publicUrl;
    });
  }

  /* ---------- Interface ---------- */
  function field(label, input) { return h("label", {}, label, input); }
  function text(obj, key, label, opts) {
    opts = opts || {};
    var el = h(opts.area ? "textarea" : "input", { type: opts.area ? null : "text", maxlength: opts.max || 200 });
    el.value = obj[key] == null ? "" : obj[key];
    el.addEventListener("input", function () { obj[key] = el.value; setDirty(true); });
    return field(label, el);
  }
  function numberField(obj, key, label) {
    var el = h("input", { type: "number", min: "0", step: "1", inputmode: "numeric" });
    el.value = obj[key] == null ? "" : obj[key];
    el.addEventListener("input", function () { obj[key] = el.value === "" ? null : Number(el.value); setDirty(true); });
    return field(label + " (vide = demande de prix)", el);
  }
  function check(obj, key, label, dflt) {
    var el = h("input", { type: "checkbox" });
    el.checked = obj[key] === undefined ? dflt : obj[key] !== false;
    el.addEventListener("change", function () { obj[key] = el.checked; setDirty(true); });
    return h("label", { class: "check" }, el, label);
  }
  function imageField(obj, key) {
    var img = h("img", { class: "thumb", alt: "", src: obj[key] ? (/^https?:/.test(obj[key]) ? obj[key] : "../" + obj[key]) : null, hidden: !obj[key] });
    var file = h("input", { type: "file", accept: "image/jpeg,image/png,image/webp", onchange: function () {
      if (!file.files[0]) return;
      run("Téléversement", function () {
        return uploadImage(file.files[0]).then(function (url) {
          obj[key] = url; setDirty(true); render(); say("Image téléversée. Pensez à enregistrer."); return true;
        });
      }).then(function () { file.value = ""; });
    } });
    return h("div", {}, img, field("Image (JPEG, PNG, WebP, 2 Mo max)", file));
  }
  function move(arr, i, d) {
    var j = i + d; if (j < 0 || j >= arr.length) return;
    var t = arr[i]; arr[i] = arr[j]; arr[j] = t; setDirty(true); render();
  }
  function variantCard(p, v, j) {
    return h("div", { class: "variant" },
      h("h4", {}, "Option " + (j + 1)),
      h("div", { class: "grid" },
        text(v, "id", "Identifiant (a-z, 0-9, -)"), text(v, "name", "Nom"),
        numberField(v, "retailPrice", "Prix (FCFA)"), text(v, "retailUnit", "Unité")),
      imageField(v, "image"),
      h("div", { class: "row" }, check(v, "available", "Disponible", true),
        h("button", { type: "button", class: "small", onclick: function () { move(p.variants, j, -1); } }, "↑"),
        h("button", { type: "button", class: "small", onclick: function () { move(p.variants, j, 1); } }, "↓"),
        h("button", { type: "button", class: "small danger", onclick: function () {
          if (confirm("Retirer cette option ?")) { p.variants.splice(j, 1); setDirty(true); render(); }
        } }, "Retirer")));
  }
  function productCard(p, i) {
    var cat = h("select", {}, CATS.map(function (c) { return h("option", { value: c[0], selected: c[0] === p.cat }, c[1]); }));
    cat.addEventListener("change", function () { p.cat = cat.value; setDirty(true); });
    var hasVariants = Array.isArray(p.variants) && p.variants.length > 0;
    return h("section", { class: "card", "aria-label": p.name || "Nouveau produit" },
      h("h3", {}, (i + 1) + ". " + (p.name || "Nouveau produit")),
      h("div", { class: "grid" },
        text(p, "id", "Identifiant (a-z, 0-9, -)"), text(p, "name", "Nom"), field("Catégorie", cat),
        hasVariants ? null : numberField(p, "price", "Prix (FCFA)"), hasVariants ? null : text(p, "unit", "Unité")),
      text(p, "desc", "Description", { area: true, max: 300 }),
      imageField(p, "image"),
      h("div", { class: "row" }, check(p, "available", "Disponible", true), check(p, "visible", "Visible sur le site", true)),
      (p.variants || []).map(function (v, j) { return variantCard(p, v, j); }),
      h("div", { class: "row" },
        h("button", { type: "button", class: "small", onclick: function () {
          p.variants = p.variants || []; p.price = null; p.unit = null;
          p.variants.push({ id: "option-" + (p.variants.length + 1), name: "", image: null, retailPrice: null, retailUnit: "unité" });
          setDirty(true); render();
        } }, "Ajouter une option"),
        h("button", { type: "button", class: "small", onclick: function () { move(cfg.products, i, -1); } }, "↑ Monter"),
        h("button", { type: "button", class: "small", onclick: function () { move(cfg.products, i, 1); } }, "↓ Descendre"),
        h("button", { type: "button", class: "small danger", onclick: function () {
          if (confirm("Supprimer « " + (p.name || "ce produit") + " » et ses options ?")) { cfg.products.splice(i, 1); setDirty(true); render(); }
        } }, "Supprimer")));
  }
  function render() {
    var bar = h("header", { class: "bar" }, h("h1", {}, "Maman Tokpa — Propriétaire"),
      h("span", { id: "dirty", class: "dirty" + (dirty ? " unsaved" : " saved") }, dirty ? "Modifications non enregistrées — cliquez sur Enregistrer" : "Brouillon enregistré"),
      h("div", { class: "actions" },
        h("button", { type: "button", onclick: function () { run("Enregistrement", function () { return saveDraft().then(function () { say("Brouillon enregistré. Pour mettre à jour le site public, cliquez sur Publier."); return true; }); }); } }, "Enregistrer"),
        h("button", { type: "button", id: "preview-button", disabled: dirty, onclick: preview }, "Aperçu du brouillon"),
        h("button", { type: "button", id: "publish-button", class: "primary", disabled: dirty, onclick: publish }, "Publier"),
        h("button", { type: "button", onclick: openHistory }, "Historique"),
        h("button", { type: "button", onclick: function () { if (dirty && !confirm("Quitter sans enregistrer ?")) return; setDirty(false); sb.auth.signOut().then(function () { cfg = null; showLogin(); }); } }, "Déconnexion")));
    var tabs = h("div", { class: "tabs", role: "tablist", "aria-label": "Rubriques" }, TABS.map(function (t) {
      return h("button", { type: "button", role: "tab", "aria-selected": String(t[0] === tab), class: "small" + (t[0] === tab ? " primary" : ""), onclick: function () { tab = t[0]; render(); } }, t[1]);
    }));
    var panels = { catalogue: tabCatalogue, textes: tabTexts, sections: tabSections, images: tabImages, contacts: tabContacts, legal: tabLegal };
    root.replaceChildren(bar, h("main", {}, tabs,
      h("div", { id: "errors", class: "errors", role: "alert", tabindex: "-1", hidden: true }), panels[tab]()));
  }
  function tabContacts() {
    return h("section", { class: "card" }, h("h2", {}, "Contacts"),
      h("div", { class: "grid" }, text(cfg, "phoneCall", "Téléphone (chiffres + indicatif)", { max: 15 }), text(cfg, "phoneWhatsapp", "WhatsApp (chiffres + indicatif)", { max: 15 })));
  }
  function tabCatalogue() {
    return h("div", {}, h("h2", {}, "Catalogue"),
      cfg.products.length ? cfg.products.map(productCard) : h("p", {}, "Aucun produit."),
      h("button", { type: "button", onclick: function () {
        cfg.products.push({ id: "produit-" + Date.now().toString(36), name: "", cat: "maison", desc: "", price: null, unit: null, image: null, available: true });
        setDirty(true); render();
      } }, "Ajouter un produit"));
  }
  function tabTexts() {
    cfg.texts = cfg.texts || {};
    return h("section", { class: "card" }, h("h2", {}, "Textes du site"),
      h("p", {}, "Retour à la ligne = saut de ligne ; *italique* ; **gras**. Un texte identique à l’original reste lié à l’original."),
      defaults.texts.map(function (d) {
        var el = h("textarea", { maxlength: "2000", rows: "2" });
        el.value = cfg.texts[d.key] !== undefined ? cfg.texts[d.key] : d.value;
        el.addEventListener("input", function () { if (el.value === d.value) delete cfg.texts[d.key]; else cfg.texts[d.key] = el.value; setDirty(true); });
        return field(d.key, el);
      }));
  }
  function tabImages() {
    cfg.images = cfg.images || {};
    return h("section", { class: "card" }, h("h2", {}, "Images du site"), defaults.images.map(function (d) {
      var cur = cfg.images[d.key] || d.src;
      var file = h("input", { type: "file", accept: "image/jpeg,image/png,image/webp", onchange: function () {
        if (!file.files[0]) return;
        run("Téléversement", function () {
          return uploadImage(file.files[0]).then(function (url) { cfg.images[d.key] = url; setDirty(true); render(); say("Image téléversée. Pensez à enregistrer."); return true; });
        }).then(function () { file.value = ""; });
      } });
      return h("div", { class: "variant" }, h("h3", {}, d.key),
        h("img", { class: "thumb", alt: "", src: /^https?:/.test(cur) ? cur : "../" + cur }),
        field("Remplacer (JPEG, PNG, WebP, 2 Mo max)", file),
        cfg.images[d.key] ? h("button", { type: "button", class: "small", onclick: function () { delete cfg.images[d.key]; setDirty(true); render(); } }, "Rétablir l’original") : null);
    }));
  }
  function tabSections() {
    if (!Array.isArray(cfg.sections)) cfg.sections = [];
    defaults.sections.forEach(function (d) { if (!cfg.sections.some(function (s) { return s.key === d.key; })) cfg.sections.push({ key: d.key, visible: true }); });
    cfg.theme = cfg.theme || {};
    return h("div", {},
      h("section", { class: "card" }, h("h2", {}, "Ordre et visibilité des sections"),
        cfg.sections.map(function (s, i) {
          return h("div", { class: "row" }, h("strong", {}, SEC_LABELS[s.key] || s.key), check(s, "visible", "Visible", true),
            h("button", { type: "button", class: "small", onclick: function () { move(cfg.sections, i, -1); } }, "↑ Monter"),
            h("button", { type: "button", class: "small", onclick: function () { move(cfg.sections, i, 1); } }, "↓ Descendre"));
        })),
      h("section", { class: "card" }, h("h2", {}, "Couleurs"),
        h("div", { class: "grid" }, Object.keys(THEME_DEFAULTS).map(function (k) {
          var el = h("input", { type: "color" });
          el.value = (cfg.theme[k] || THEME_DEFAULTS[k]).toLowerCase();
          el.addEventListener("input", function () { if (el.value === THEME_DEFAULTS[k]) delete cfg.theme[k]; else cfg.theme[k] = el.value; setDirty(true); });
          return field(THEME_LABELS[k], el);
        })),
        h("div", { class: "row" }, h("button", { type: "button", class: "small", onclick: function () { cfg.theme = {}; setDirty(true); render(); } }, "Rétablir les couleurs officielles"))));
  }
  function tabLegal() {
    cfg.legal = cfg.legal || [];
    return h("section", { class: "card" }, h("h2", {}, "Informations légales"),
      h("p", {}, "Aucun texte n’est fourni par défaut : saisissez vos textes validés. Seuls les textes publiés s’affichent sur le site."),
      cfg.legal.map(function (l, i) {
        return h("div", { class: "variant" },
          h("div", { class: "grid" }, text(l, "slug", "Identifiant (a-z, 0-9, -)"), text(l, "title", "Titre")),
          text(l, "body", "Texte (ligne vide = nouveau paragraphe)", { area: true, max: 20000 }),
          h("div", { class: "row" }, check(l, "published", "Publié", false),
            h("button", { type: "button", class: "small", onclick: function () { move(cfg.legal, i, -1); } }, "↑"),
            h("button", { type: "button", class: "small", onclick: function () { move(cfg.legal, i, 1); } }, "↓"),
            h("button", { type: "button", class: "small danger", onclick: function () { if (confirm("Supprimer ce texte légal ?")) { cfg.legal.splice(i, 1); setDirty(true); render(); } } }, "Supprimer")));
      }),
      h("button", { type: "button", onclick: function () { cfg.legal.push({ slug: "texte-" + Date.now().toString(36), title: "", body: "", published: false }); setDirty(true); render(); } }, "Ajouter un texte légal"));
  }
  function preview() {
    if (dirty) return say("Enregistrez vos modifications avant d’ouvrir l’aperçu du brouillon.", true);
    var errs = validate(cfg);
    if (errs.length) { showErrors(errs); return say("Corrigez les erreurs avant l’aperçu.", true); }
    try { localStorage.setItem("mm-preview", JSON.stringify(cfg)); } catch (e) { return say("Aperçu impossible : stockage du navigateur indisponible.", true); }
    window.open("../index.html?preview=1", "_blank");
  }
  function publish() {
    if (dirty) return say("Enregistrez vos modifications avant de les publier.", true);
    if (!confirm("Publier le brouillon sur le site public ?")) return;
    run("Publication", function () {
      return sb.rpc("publish_site", { note: new Date().toISOString() })
        .then(function (r) { if (r.error) throw r.error; say("Publié. Le site public est à jour."); return true; });
    });
  }
  function openHistory() {
    run("Historique", function () {
      return sb.from("site_versions").select("id,created_at,note").order("id", { ascending: false }).limit(20).then(function (r) {
        if (r.error) throw r.error;
        historyEl.replaceChildren(h("h2", { id: "history-title" }, "Versions publiées"),
          r.data.length ? h("ul", {}, r.data.map(function (v) {
            return h("li", { class: "row" }, new Date(v.created_at).toLocaleString("fr-FR"),
              h("button", { type: "button", class: "small", onclick: function () {
                if (!confirm("Charger cette version dans le brouillon ? Le brouillon actuel sera remplacé (rien n’est publié).")) return;
                run("Restauration", function () {
                  return sb.rpc("restore_version", { vid: v.id }).then(function (x) {
                    if (x.error) throw x.error;
                    historyEl.close(); return loadDraft().then(function () { say("Version chargée dans le brouillon. Cliquez sur Publier pour la remettre en ligne."); return true; });
                  });
                });
              } }, "Restaurer"));
          })) : h("p", {}, "Aucune version."),
          h("div", { class: "row" }, h("button", { type: "button", onclick: function () { historyEl.close(); } }, "Fermer")));
        historyEl.showModal(); return true;
      });
    });
  }

  /* ---------- Démarrage ---------- */
  if (!env.SUPABASE_URL || !env.SUPABASE_ANON_KEY || !window.supabase) {
    root.replaceChildren(h("main", {}, h("p", { class: "errors", role: "alert" }, "Configuration Supabase manquante (assets/js/env.js).")));
    return;
  }
  sb = window.supabase.createClient(env.SUPABASE_URL, env.SUPABASE_ANON_KEY);
  sb.auth.getSession().then(function (r) {
    if (!r.data.session) return showLogin();
    return sb.rpc("is_owner", {}).then(function (owner) {
      if (owner.error) throw new Error("Vérification du propriétaire impossible : " + owner.error.message);
      if (!owner.data) throw new Error("Compte connecté, mais non autorisé : ajoutez cet utilisateur à public.app_owner dans Supabase.");
      return loadDraft();
    }).catch(function (e) {
      return sb.auth.signOut().then(function () { showLogin(e.message || "Impossible de charger le brouillon."); });
    });
  }).catch(function (e) { showLogin(e.message || "Réseau indisponible. Réessayez."); });
})();
