/* Charge le contenu publié depuis Supabase ; repli sur config.js en cas d'échec. */
(function () {
  var env = window.MM_ENV || {};
  var preview = /[?&]preview=1/.test(location.search);
  function load() {
    var s = document.createElement("script");
    s.src = "assets/js/main.js";
    document.body.appendChild(s);
  }
  function apply(d) {
    if (!d || !Array.isArray(d.products)) return;
    d.products = d.products.filter(function (p) { return p.visible !== false; });
    window.SITE_CONFIG = d;
    try { window.MMContent.apply(d); } catch (e) {}
  }
  if (preview) {
    try { apply(JSON.parse(localStorage.getItem("mm-preview"))); } catch (e) {}
    var b = document.createElement("div");
    b.textContent = "Aperçu du brouillon — non publié";
    b.setAttribute("role", "status");
    b.style.cssText = "position:fixed;bottom:0;left:0;right:0;z-index:9999;padding:8px;text-align:center;background:#FFD43B;color:#24160F;font:700 14px sans-serif";
    document.body.appendChild(b);
    load();
    return;
  }
  if (!env.SUPABASE_URL || !env.SUPABASE_ANON_KEY) { load(); return; }
  var ctrl = new AbortController();
  var t = setTimeout(function () { ctrl.abort(); }, 4000);
  fetch(env.SUPABASE_URL + "/rest/v1/site_published?id=eq.1&select=data", {
    headers: { apikey: env.SUPABASE_ANON_KEY }, signal: ctrl.signal
  })
    .then(function (r) { return r.ok ? r.json() : Promise.reject(); })
    .then(function (rows) { apply(rows[0] && rows[0].data); })
    .catch(function () {})
    .then(function () { clearTimeout(t); load(); });
})();
