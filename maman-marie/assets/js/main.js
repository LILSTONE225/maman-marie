(function () {
  "use strict";
  var root = document.documentElement;
  try {
    var cfg = window.SITE_CONFIG;
    var $ = function (s, c) { return (c || document).querySelector(s); };
    var $$ = function (s, c) { return Array.prototype.slice.call((c || document).querySelectorAll(s)); };
    var reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;

    /* ---------- Contacts (validation du format, jamais de modification) ---------- */
    var valid = function (n) { return /^\d{8,15}$/.test(n || ""); };
    var waNum = valid(cfg.phoneWhatsapp) ? cfg.phoneWhatsapp : "";
    var callNum = valid(cfg.phoneCall) ? cfg.phoneCall : "";
    var waLink = function (msg) {
      return "https://wa.me/" + waNum + "?text=" + encodeURIComponent(msg);
    };
    var disable = function (el) {
      el.setAttribute("aria-disabled", "true");
      el.removeAttribute("target");
      el.addEventListener("click", function (e) { e.preventDefault(); $("#contact-notice").hidden = false; });
    };
    var waBtn = $("[data-wa]"), callBtn = $("[data-call]");
    if (waNum) {
      waBtn.href = waLink("Bonjour Maman Marie, je souhaite passer commande.");
      waBtn.target = "_blank"; waBtn.rel = "noopener noreferrer";
    } else disable(waBtn);
    if (callNum) callBtn.href = "tel:+" + callNum; else disable(callBtn);

    /* ---------- Produits ---------- */
    var esc = function (s) { var d = document.createElement("div"); d.textContent = s; return d.innerHTML; };
    var priceText = function (p) {
      if (typeof p.price !== "number") return "Prix sur demande";
      return new Intl.NumberFormat("fr-FR").format(p.price) + " FCFA" + (p.unit ? " / " + esc(p.unit) : "");
    };
    var cardHTML = function (p) {
      var media = p.image
        ? '<img src="' + esc(p.image) + '" alt="' + esc(p.name) + '" width="800" height="600" loading="lazy" decoding="async">'
        : '<div class="ph" role="img" aria-label="Photo de ' + esc(p.name) + ' à venir"><b aria-hidden="true">' + esc(p.name.charAt(0)) + '</b><small>Photo à venir</small></div>';
      var href = waNum ? waLink("Bonjour, je souhaite commander : " + p.name + ". Pouvez-vous m'indiquer le prix et la disponibilité ?") : "#contact";
      var attrs = waNum ? ' target="_blank" rel="noopener noreferrer"' : ' data-needs-contact';
      return '<article class="card"><div class="media">' + media + '</div><div class="body"><h3>' + esc(p.name) +
        '</h3><p>' + esc(p.desc) + '</p><div class="row"><span class="price">' + priceText(p) +
        '</span><a class="btn btn-primary" href="' + href + '"' + attrs + ' aria-label="Commander ' + esc(p.name) + '">Commander</a></div></div></article>';
    };

    var grid = $("#grid"), empty = $("#empty"), count = $("#count");
    var io = "IntersectionObserver" in window ? new IntersectionObserver(function (es) {
      es.forEach(function (e) { if (e.isIntersecting) { e.target.classList.add("in"); io.unobserve(e.target); } });
    }, { threshold: 0.12, rootMargin: "0px 0px -6% 0px" }) : null;
    var observe = function (el) { if (io) io.observe(el); else el.classList.add("in"); };

    var featured = $("#featured");
    featured.innerHTML = cfg.products.slice(0, 3).map(cardHTML).join("");
    $$(".card", featured).forEach(function (c, i) { c.style.transitionDelay = i * 90 + "ms"; observe(c); });

    var render = function (cat) {
      var list = cfg.products.filter(function (p) { return cat === "all" || p.cat === cat; });
      grid.style.minHeight = grid.offsetHeight + "px"; /* évite le saut de grille */
      grid.innerHTML = list.map(function (p) { return '<li>' + cardHTML(p) + '</li>'; }).join("");
      $$(".card", grid).forEach(function (c, i) { c.style.transitionDelay = i * 60 + "ms"; observe(c); });
      empty.hidden = list.length > 0;
      count.textContent = list.length + " collation(s) affichée(s)";
      requestAnimationFrame(function () { grid.style.minHeight = ""; });
    };
    var setFilter = function (cat) {
      $$(".chip").forEach(function (c) { c.setAttribute("aria-pressed", String(c.dataset.filter === cat)); });
      render(cat);
    };
    $("#filters").addEventListener("click", function (e) {
      var b = e.target.closest(".chip"); if (b) setFilter(b.dataset.filter);
    });
    $("[data-filter-reset]").addEventListener("click", function () { setFilter("all"); });
    document.addEventListener("click", function (e) {
      if (e.target.closest("[data-needs-contact]")) $("#contact-notice").hidden = false;
    });
    render("all");

    /* ---------- Révélations ---------- */
    $$(".reveal").forEach(observe);

    /* ---------- Menu mobile ---------- */
    var burger = $("#burger"), menu = $("#menu"), nav = $("#nav");
    var setMenu = function (open) {
      menu.classList.toggle("open", open);
      burger.setAttribute("aria-expanded", String(open));
      burger.setAttribute("aria-label", open ? "Fermer le menu" : "Ouvrir le menu");
      document.body.style.overflow = open ? "hidden" : "";
    };
    burger.addEventListener("click", function () { setMenu(!menu.classList.contains("open")); });
    menu.addEventListener("click", function (e) { if (e.target.closest("a")) setMenu(false); });
    document.addEventListener("keydown", function (e) { if (e.key === "Escape" && menu.classList.contains("open")) { setMenu(false); burger.focus(); } });

    /* ---------- Section active ---------- */
    if (io) {
      var links = $$(".menu a");
      var so = new IntersectionObserver(function (es) {
        es.forEach(function (e) {
          if (e.isIntersecting) links.forEach(function (a) {
            var on = a.getAttribute("href") === "#" + e.target.id;
            a.classList.toggle("active", on);
            if (on) a.setAttribute("aria-current", "true"); else a.removeAttribute("aria-current");
          });
        });
      }, { rootMargin: "-45% 0px -50% 0px" });
      $$("[data-section]").forEach(function (s) { so.observe(s); });
    }

    /* ---------- Défilement : un seul handler, throttlé par rAF ---------- */
    var bar = $("#progress"), totop = $("#totop"), par = $$("[data-parallax]");
    var lastY = 0, ticking = false;
    var update = function () {
      var y = window.scrollY, max = document.documentElement.scrollHeight - window.innerHeight;
      bar.style.transform = "scaleX(" + (max > 0 ? y / max : 0) + ")";
      nav.classList.toggle("scrolled", y > 40);
      if (!menu.classList.contains("open")) nav.classList.toggle("hidden", y > lastY && y > 300);
      lastY = y;
      totop.hidden = y < 700;
      if (!reduce && y < window.innerHeight * 1.5) par.forEach(function (el) { el.style.transform = "translate3d(0," + y * parseFloat(el.dataset.parallax) + "px,0)"; });
      ticking = false;
    };
    window.addEventListener("scroll", function () { if (!ticking) { ticking = true; requestAnimationFrame(update); } }, { passive: true });
    nav.addEventListener("focusin", function () { nav.classList.remove("hidden"); });
    totop.addEventListener("click", function () { window.scrollTo({ top: 0, behavior: reduce ? "auto" : "smooth" }); });
    update();

    $("#year").textContent = new Date().getFullYear();
  } catch (err) {
    /* Échec : on retire le mode animé pour que tout le contenu reste visible. */
    root.classList.remove("js");
    console.error(err);
  }
})();
