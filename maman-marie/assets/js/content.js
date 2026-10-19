/* Contenu éditable : application sûre (aucun innerHTML) — partagé par le site et l'espace propriétaire. */
(function () {
  var IMG_RE = /^(assets\/img\/[\w.-]+|https:\/\/[a-z0-9-]+\.supabase\.co\/storage\/v1\/object\/public\/site-images\/[\w\/.-]+)$/i;
  var HEX = /^#[0-9a-fA-F]{6}$/;
  var THEME = { orange: "--orange", yellow: "--yellow", cocoa: "--cocoa", cream: "--cream", orangeDark: "--orange-d" };
  var SECTION_LINKS = { accueil: "#accueil", collations: "#collations", univers: "#univers", contact: "#contact" };

  /* Mini-balisage : saut de ligne = <br>, *x* = <em>, **x** = <b>. */
  function rich(el, str) {
    el.textContent = "";
    var re = /\*\*(.+?)\*\*|\*(.+?)\*|\n/g, i = 0, m;
    var add = function (t) { if (t) el.appendChild(document.createTextNode(t)); };
    while ((m = re.exec(str))) {
      add(str.slice(i, m.index));
      if (m[0] === "\n") el.appendChild(document.createElement("br"));
      else { var n = document.createElement(m[1] != null ? "b" : "em"); n.textContent = m[1] != null ? m[1] : m[2]; el.appendChild(n); }
      i = re.lastIndex;
    }
    add(str.slice(i));
  }
  function toMarkup(el) {
    var out = "";
    el.childNodes.forEach(function (n) {
      if (n.nodeType === 3) out += n.nodeValue;
      else if (n.nodeName === "BR") out += "\n";
      else if (n.nodeName === "B" || n.nodeName === "STRONG") out += "**" + n.textContent + "**";
      else if (n.nodeName === "EM") out += "*" + n.textContent + "*";
      else out += n.textContent;
    });
    return out.replace(/\s+\n/g, "\n").trim();
  }
  function apply(c) {
    var $$ = function (s) { return Array.prototype.slice.call(document.querySelectorAll(s)); };
    if (c.texts) $$("[data-c]").forEach(function (el) {
      var v = c.texts[el.getAttribute("data-c")];
      if (typeof v === "string" && v.length <= 2000) rich(el, v);
    });
    if (c.images) $$("[data-img]").forEach(function (el) {
      var v = c.images[el.getAttribute("data-img")];
      if (typeof v === "string" && IMG_RE.test(v)) el.setAttribute("src", v);
    });
    if (c.theme) Object.keys(THEME).forEach(function (k) {
      if (HEX.test(c.theme[k] || "")) document.documentElement.style.setProperty(THEME[k], c.theme[k]);
    });
    if (Array.isArray(c.sections)) {
      var main = document.getElementById("main"), seen = {};
      c.sections.forEach(function (s) {
        var el = main.querySelector('[data-sec="' + s.key + '"]');
        if (!el || seen[s.key]) return;
        seen[s.key] = 1;
        main.appendChild(el);
        el.hidden = s.visible === false;
        var href = SECTION_LINKS[s.key];
        if (href) $$('.menu a[href="' + href + '"]').forEach(function (a) { a.hidden = s.visible === false; });
      });
    }
    var list = document.getElementById("legal-list"), items = (c.legal || []).filter(function (l) { return l.published && l.title && l.body; });
    if (list && items.length) {
      items.forEach(function (l) {
        var a = document.createElement("article"), h = document.createElement("h3");
        h.textContent = l.title; if (/^[a-z0-9-]+$/.test(l.slug || "")) a.id = "legal-" + l.slug;
        a.appendChild(h);
        String(l.body).split(/\n{2,}/).forEach(function (t) { var p = document.createElement("p"); p.textContent = t; a.appendChild(p); });
        if (l.updated) { var s = document.createElement("small"); s.textContent = "Mis à jour le " + new Date(l.updated).toLocaleDateString("fr-FR"); a.appendChild(s); }
        list.appendChild(a);
      });
      document.getElementById("legal-section").hidden = false;
      document.getElementById("legal-link").hidden = false;
    }
  }
  window.MMContent = { rich: rich, toMarkup: toMarkup, apply: apply, IMG_RE: IMG_RE, HEX: HEX, THEME_VARS: THEME };
})();
