(function () {
  "use strict";
  var root = document.documentElement;
  try {
    var cfg = window.SITE_CONFIG;
    var $ = function (s, c) { return (c || document).querySelector(s); };
    var $$ = function (s, c) { return Array.prototype.slice.call((c || document).querySelectorAll(s)); };
    var reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;

    /* ---------- Transition du logo d'intro vers la navigation ---------- */
    var intro = $("#intro");
    if (intro && !root.classList.contains("no-intro") && !reduce) {
      window.setTimeout(function () {
        intro.classList.add("intro-settle");
        var logo = $(".intro-content img", intro), brandLogo = $(".brand-logo");
        if (!logo || !brandLogo) {
          intro.classList.add("is-done");
          return;
        }

        var start = logo.getBoundingClientRect();
        $("#nav").classList.remove("hidden");
        var end = brandLogo.getBoundingClientRect();
        if (!start.width || !end.width) {
          intro.classList.add("is-done");
          return;
        }

        var finishIntro = function () {
          intro.classList.add("intro-fading");
          window.setTimeout(function () {
            intro.classList.add("is-done");
            root.classList.remove("intro-moving");
            logo.removeAttribute("style");
          }, 300);
        };
        if (typeof logo.animate !== "function") {
          finishIntro();
          return;
        }

        root.classList.add("intro-moving");
        var width = window.innerWidth, height = window.innerHeight;
        var sx = start.left + start.width / 2, sy = start.top + start.height / 2;
        var ex = end.left + end.width / 2, ey = end.top + end.height / 2;
        var cx = (sx + ex) * .35, cy = Math.min(sy, ey) - height * .14;
        var svg = document.createElementNS("http://www.w3.org/2000/svg", "svg");
        var trail = document.createElementNS("http://www.w3.org/2000/svg", "path");
        svg.setAttribute("class", "intro-trail");
        svg.setAttribute("viewBox", "0 0 " + width + " " + height);
        svg.setAttribute("aria-hidden", "true");
        trail.setAttribute("d", "M " + sx + " " + sy + " Q " + cx + " " + cy + " " + ex + " " + ey);
        svg.appendChild(trail);
        intro.appendChild(svg);
        var trailLength = trail.getTotalLength();
        trail.style.strokeDasharray = trailLength;
        trail.style.strokeDashoffset = trailLength;

        logo.style.cssText = "position:fixed;left:0;top:0;width:" + end.width + "px;height:" + end.height +
          "px;margin:0;z-index:3;opacity:1;transform-origin:top left;animation:none";
        var keyframes = [0, .25, .5, .75, 1].map(function (t) {
          var inverse = 1 - t;
          var scale = start.width / end.width * inverse + t;
          var x = inverse * inverse * sx + 2 * inverse * t * cx + t * t * ex - end.width * scale / 2;
          var y = inverse * inverse * sy + 2 * inverse * t * cy + t * t * ey - end.height * scale / 2;
          return {
            offset: t,
            transform: "translate(" + x + "px," + y + "px) scale(" + scale + ") rotate(" + (1080 * t) + "deg)",
            borderWidth: (5 - 3 * t) + "px",
            opacity: 1,
            filter: "brightness(" + (1.35 - .35 * t) + ")"
          };
        });
        var move = logo.animate(keyframes, { duration: 1650, easing: "cubic-bezier(.16,1,.3,1)", fill: "forwards" });
        if (typeof trail.animate === "function") {
          trail.animate([
            { strokeDashoffset: trailLength, opacity: 1 },
            { strokeDashoffset: 0, opacity: 1, offset: .78 },
            { strokeDashoffset: 0, opacity: 0 }
          ], { duration: 1650, easing: "linear", fill: "forwards" });
        } else {
          trail.style.strokeDashoffset = 0;
        }
        move.onfinish = finishIntro;
      }, 4100);
    }

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
      waBtn.href = waLink("Bonjour Maman Tokpa, je souhaite passer commande.");
      waBtn.target = "_blank"; waBtn.rel = "noopener noreferrer";
    } else disable(waBtn);
    if (callNum) callBtn.href = "tel:+" + callNum; else disable(callBtn);

    /* ---------- Produits ---------- */
    var esc = function (s) { var d = document.createElement("div"); d.textContent = s; return d.innerHTML; };
    var formatPrice = function (price) { return new Intl.NumberFormat("fr-FR").format(price) + " FCFA"; };
    var getVariant = function (product, id) {
      return product.variants && product.variants.filter(function (variant) { return variant.id === id; })[0];
    };
    var productImageHTML = function (product, variant) {
      var image = variant && variant.image ? variant.image : product.image;
      var label = variant ? variant.name : product.name;
      return image
        ? '<img src="' + esc(image) + '" alt="' + esc(label) + '" width="800" height="600" loading="lazy" decoding="async">'
        : '<div class="ph' + (variant ? ' variant-ph' : '') + '" role="img" aria-label="Photo de ' + esc(label) + ' à venir"><b aria-hidden="true">' + esc(label.charAt(0)) + '</b><small>Photo à venir</small></div>';
    };
    var orderMessage = function (product, variant, quantity, wholesaleAmount) {
      if (typeof wholesaleAmount === "number") {
        var profit = wholesaleAmount / 1000 * 250;
        return [
          "Bonjour, je souhaite passer une commande.",
          "",
          "- Produit : " + product.name,
          variant ? "- Option choisie : " + (variant.recipe || variant.name) : null,
          "- Type de commande : achat en gros pour revente",
          "- Montant d'achat en gros : " + formatPrice(wholesaleAmount),
          "- Bénéfice potentiel estimé si revendu : " + formatPrice(profit),
          "- Montant potentiel après revente : " + formatPrice(wholesaleAmount + profit),
          "Merci !"
        ].filter(Boolean).join("\n");
      }
      var unitPrice = variant ? variant.retailPrice : product.price;
      if (typeof unitPrice !== "number") return "Bonjour, je souhaite commander : " + product.name + ". Pouvez-vous m'indiquer le prix et la disponibilité ?";
      return [
        "Bonjour, je souhaite passer une commande.",
        "",
        "- Produit : " + product.name,
        variant ? "- Option choisie : " + (variant.recipe || variant.name) : null,
        "- Prix unitaire de détail : " + formatPrice(unitPrice),
        "- Quantité : " + quantity + " unité(s)",
        "- Sous-total : " + formatPrice(unitPrice * quantity),
        "Merci !"
      ].filter(Boolean).join("\n");
    };
    var cardHTML = function (p) {
      var variants = p.variants || [];
      var selected = variants[0];
      var name = selected ? selected.name : p.name;
      var href = waNum ? waLink(orderMessage(p, selected, 1)) : "#contact";
      var attrs = waNum ? ' target="_blank" rel="noopener noreferrer"' : ' data-needs-contact';
      var variantSelector = variants.length
        ? '<label class="variant-control"><span>Choisir une option</span><select data-variant-select aria-label="Choisir une option pour ' + esc(p.name) + '">' +
          variants.map(function (variant, i) {
            return '<option value="' + esc(variant.id) + '"' + (i === 0 ? ' selected' : '') + '>' + esc(variant.name) + '</option>';
          }).join("") + '</select></label>'
        : "";
      var hasPrice = variants.some(function (variant) { return typeof variant.retailPrice === "number"; }) || typeof p.price === "number";
      var unitPrice = selected ? selected.retailPrice : p.price;
      var hasWholesale = p.id === "cacahuetes";
      var soldOut = p.available === false || (selected && selected.available === false);
      var offer = p.offer ? '<p class="product-offer">' + esc(p.offer) + '</p>' : "";
      var purchaseMode = hasWholesale
        ? '<div class="wholesale-feature">' +
          '<aside class="wholesale-offer" aria-label="Offre de vente en gros">' +
          '<strong>Vente en gros possible pour les cacahuètes</strong>' +
          '<p>' + esc(p.offer || 'Dès 1 000 FCFA d’achat, gagnez 250 FCFA de bénéfice potentiel par tranche de 1 000 FCFA si vous revendez.') + '</p></aside>' +
          '<label class="purchase-mode"><span>Type d’achat</span><select data-purchase-mode aria-label="Choisir un achat classique ou en gros pour ' + esc(p.name) + '">' +
          '<option value="retail">Achat classique</option><option value="wholesale">Achat en gros pour revendre</option>' +
          '</select></label></div>'
        : "";
      var pricing = hasPrice
        ? '<div class="retail-price"><span>Prix unitaire de détail</span><strong data-retail-price>' + formatPrice(unitPrice) + '</strong></div>' +
          '<label class="quantity-control"><span>Quantité (unités)</span><input data-quantity type="number" min="1" step="1" value="1" inputmode="numeric" aria-label="Quantité en unités de ' + esc(p.name) + '"></label>' +
          '<p class="subtotal" aria-live="polite">Sous-total : <strong data-subtotal>' + formatPrice(unitPrice) + '</strong></p>' +
          '<p class="retail-note">Prix de détail à l’unité, hors prix de gros.</p>'
        : '<span class="price">Prix sur demande</span>';
      var orderPricing = hasWholesale
        ? variantSelector + '<div data-retail-order>' + pricing + '</div>' +
          '<div class="wholesale-order" data-wholesale-order hidden>' +
          '<label class="wholesale-amount-control"><span>Montant de l’achat en gros (FCFA)</span>' +
          '<input data-wholesale-amount type="number" min="1000" step="1000" value="1000" inputmode="numeric" aria-label="Montant de l’achat en gros en tranches de 1 000 FCFA"></label>' +
          '<p class="wholesale-estimate" aria-live="polite">Bénéfice potentiel si revendu : <strong data-wholesale-profit>250 FCFA</strong></p>' +
          '<p class="wholesale-estimate">Montant potentiel après revente : <strong data-wholesale-total>1 250 FCFA</strong></p></div>'
        : variantSelector + pricing;
      return '<article class="card' + (variants.length ? ' has-variants' : '') + (hasPrice ? ' has-order-pricing' : '') + '" data-product-id="' + esc(p.id) + '">' +
        '<div class="media" data-product-media>' + productImageHTML(p, selected) + '</div><div class="body">' +
        '<h3 data-product-name>' + esc(name) + '</h3><p>' + esc(p.desc) + '</p>' + (!hasWholesale ? offer : "") +
        '<p class="stock-status" data-stock-status' + (soldOut ? "" : " hidden") + '>Rupture de stock</p>' + purchaseMode + orderPricing +
        '<div class="row">' +
        '<a class="btn btn-primary" data-product-order data-sold-out="' + String(soldOut) + '" href="' + (soldOut ? "#" : href) + '"' + attrs +
        (soldOut ? ' aria-disabled="true"' : "") + ' aria-label="' + (soldOut ? "En rupture de stock : " : "Commander ") + esc(name) + '">' +
        (soldOut ? "Rupture de stock" : "Commander") + '</a></div></div></article>';
    };

    var updateProductCard = function (card) {
      var product = cfg.products.filter(function (item) { return item.id === card.dataset.productId; })[0];
      var select = $("[data-variant-select]", card), quantityInput = $("[data-quantity]", card);
      var order = $("[data-product-order]", card);
      if (!product || !order) return;
      var variant = select ? getVariant(product, select.value) : null;
      if (variant) {
        $("[data-product-name]", card).textContent = card.closest("#featured") && product.id === "croquettes"
          ? product.name
          : variant.name;
        $("[data-product-media]", card).innerHTML = productImageHTML(product, variant);
      }
      var soldOut = product.available === false || (variant && variant.available === false);
      var stockStatus = $("[data-stock-status]", card);
      stockStatus.hidden = !soldOut;
      if (soldOut) {
        order.href = "#";
        order.textContent = "Rupture de stock";
        order.setAttribute("aria-disabled", "true");
        order.setAttribute("aria-label", "En rupture de stock : " + (variant ? variant.name : product.name));
        order.dataset.soldOut = "true";
        delete order.dataset.invalidOrder;
        return;
      }
      if (order.dataset.soldOut === "true") {
        delete order.dataset.soldOut;
        order.removeAttribute("aria-disabled");
        order.textContent = "Commander";
        order.href = waNum ? waLink(orderMessage(product, variant, 1)) : "#contact";
      }
      order.setAttribute("aria-label", "Commander " + (variant ? variant.name : product.name));
      var purchaseMode = $("[data-purchase-mode]", card);
      if (purchaseMode) {
        var wholesalePanel = $("[data-wholesale-order]", card);
        var retailPanel = $("[data-retail-order]", card);
        var wholesale = purchaseMode.value === "wholesale";
        wholesalePanel.hidden = !wholesale;
        retailPanel.hidden = wholesale;
        if (wholesale) {
          var amountInput = $("[data-wholesale-amount]", card);
          var wholesaleAmount = Number(amountInput.value);
          var validAmount = Number.isSafeInteger(wholesaleAmount) && wholesaleAmount >= 1000 && wholesaleAmount % 1000 === 0;
          var profit = validAmount ? wholesaleAmount / 1000 * 250 : 0;
          amountInput.setAttribute("aria-invalid", String(!validAmount));
          $("[data-wholesale-profit]", card).textContent = validAmount ? formatPrice(profit) : "—";
          $("[data-wholesale-total]", card).textContent = validAmount ? formatPrice(wholesaleAmount + profit) : "—";
          order.setAttribute("aria-label", "Commander " + product.name + " en gros pour revendre");
          order.textContent = "Commander en gros";
          if (!validAmount) {
            order.setAttribute("aria-disabled", "true");
            order.dataset.invalidOrder = "true";
            return;
          }
          delete order.dataset.invalidOrder;
          order.removeAttribute("aria-disabled");
          if (waNum) order.href = waLink(orderMessage(product, variant, 1, wholesaleAmount));
          return;
        }
      }
      if (!quantityInput) return;
      var unitPrice = variant ? variant.retailPrice : product.price;
      var quantity = Number(quantityInput.value);
      var validQuantity = Number.isSafeInteger(quantity) && quantity > 0;
      if (select && !variant) {
        order.setAttribute("aria-disabled", "true");
        order.dataset.invalidOrder = "true";
        return;
      }

      $("[data-retail-price]", card).textContent = formatPrice(unitPrice);
      order.textContent = "Commander";
      quantityInput.setAttribute("aria-invalid", String(!validQuantity));
      $("[data-subtotal]", card).textContent = validQuantity
        ? formatPrice(unitPrice * quantity)
        : "Saisissez une quantité valide";
      order.setAttribute("aria-label", "Commander " + (variant ? variant.name : product.name));
      if (!validQuantity) {
        order.setAttribute("aria-disabled", "true");
        order.dataset.invalidOrder = "true";
        return;
      }

      delete order.dataset.invalidOrder;
      order.removeAttribute("aria-disabled");
      if (waNum) order.href = waLink(orderMessage(product, variant, quantity));
    };

    var grid = $("#grid"), empty = $("#empty"), count = $("#count");
    var io = "IntersectionObserver" in window ? new IntersectionObserver(function (es) {
      es.forEach(function (e) { if (e.isIntersecting) { e.target.classList.add("in"); io.unobserve(e.target); } });
    }, { threshold: 0.12, rootMargin: "0px 0px -6% 0px" }) : null;
    var observe = function (el) { if (io) io.observe(el); else el.classList.add("in"); };

    var featured = $("#featured"), featuredCarousel = $("#featured-carousel");
    var featuredProducts = cfg.products.slice(0, 4), featuredCards = [];
    featured.innerHTML = featuredProducts.map(cardHTML).join("");
    featuredCards = $$(".card", featured);
    var indicators = $(".carousel-indicators", featuredCarousel);
    indicators.innerHTML = featuredProducts.map(function (product, i) {
      return '<button class="carousel-indicator" type="button" data-featured-index="' + i + '" aria-label="Afficher ' + esc(product.name) + '" aria-pressed="false"></button>';
    }).join("");
    featuredCards.forEach(function (card, i) {
      card.setAttribute("role", "group");
      card.setAttribute("aria-roledescription", "diapositive");
      card.setAttribute("aria-label", (i + 1) + " sur " + featuredCards.length + " : " + featuredProducts[i].name);
      if (featuredProducts[i].id === "croquettes") $("[data-product-name]", card).textContent = featuredProducts[i].name;
      card.setAttribute("aria-hidden", "true");
      card.inert = true;
      observe(card);
    });

    var featuredIndex = 0, featuredTimer = 0, featuredVisible = !("IntersectionObserver" in window);
    var featuredPaused = false, featuredHovered = false, featuredFocused = false, featuredForcePlay = false;
    var featuredReduce = window.matchMedia("(prefers-reduced-motion: reduce)");
    var featuredToggle = $("[data-featured-toggle]", featuredCarousel);
    var featuredStatus = $("[data-featured-status]", featuredCarousel);
    var showFeatured = function (index) {
      if (!featuredCards.length) return;
      var previous = featuredCards[featuredIndex];
      featuredIndex = (index + featuredCards.length) % featuredCards.length;
      if (previous && previous !== featuredCards[featuredIndex]) {
        previous.classList.remove("is-active");
        previous.classList.add("is-leaving");
        previous.setAttribute("aria-hidden", "true");
        previous.inert = true;
        window.setTimeout(function () { previous.classList.remove("is-leaving"); }, 850);
      }
      featuredCards.forEach(function (card, i) {
        if (i === featuredIndex) {
          card.classList.remove("is-leaving");
          card.classList.add("is-active");
          card.removeAttribute("aria-hidden");
          card.inert = false;
        }
      });
      $$("[data-featured-index]", featuredCarousel).forEach(function (button, i) {
        button.setAttribute("aria-pressed", String(i === featuredIndex));
      });
      var title = $("h3", featuredCards[featuredIndex]);
      featuredStatus.textContent = "Collation " + (featuredIndex + 1) + " sur " + featuredCards.length + " : " + (title ? title.textContent : featuredProducts[featuredIndex].name);
    };
    var stopFeaturedTimer = function () {
      window.clearInterval(featuredTimer);
      featuredTimer = 0;
    };
    var syncFeaturedTimer = function () {
      stopFeaturedTimer();
      var interactionAllowsPlay = featuredForcePlay || (!featuredHovered && !featuredFocused);
      if (featuredCards.length > 1 && featuredVisible && !featuredPaused && interactionAllowsPlay &&
          !document.hidden && !featuredReduce.matches) {
        featuredTimer = window.setInterval(function () { showFeatured(featuredIndex + 1); }, 2000);
      }
      featuredToggle.setAttribute("aria-pressed", String(featuredPaused));
      featuredToggle.setAttribute("aria-label", featuredPaused ? "Reprendre le carrousel" : "Mettre le carrousel en pause");
      featuredToggle.textContent = featuredPaused ? "▶" : "Ⅱ";
      featuredStatus.setAttribute("aria-live", featuredTimer ? "off" : "polite");
    };
    showFeatured(0);
    featuredCarousel.addEventListener("click", function (event) {
      var button = event.target.closest("[data-featured-previous],[data-featured-next],[data-featured-index],[data-featured-toggle]");
      if (!button) return;
      if (button.hasAttribute("data-featured-previous")) showFeatured(featuredIndex - 1);
      else if (button.hasAttribute("data-featured-next")) showFeatured(featuredIndex + 1);
      else if (button.hasAttribute("data-featured-index")) showFeatured(Number(button.dataset.featuredIndex));
      else {
        featuredPaused = !featuredPaused;
        featuredForcePlay = !featuredPaused;
      }
      syncFeaturedTimer();
    });
    featuredCarousel.addEventListener("pointerenter", function () { featuredHovered = true; featuredForcePlay = false; syncFeaturedTimer(); });
    featuredCarousel.addEventListener("pointerleave", function () { featuredHovered = false; syncFeaturedTimer(); });
    featuredCarousel.addEventListener("focusin", function () { featuredFocused = true; featuredForcePlay = false; syncFeaturedTimer(); });
    featuredCarousel.addEventListener("focusout", function () {
      window.setTimeout(function () {
        featuredFocused = featuredCarousel.contains(document.activeElement);
        syncFeaturedTimer();
      }, 0);
    });
    document.addEventListener("visibilitychange", syncFeaturedTimer);
    if (featuredReduce.addEventListener) featuredReduce.addEventListener("change", syncFeaturedTimer);
    if ("IntersectionObserver" in window) {
      var featuredObserver = new IntersectionObserver(function (entries) {
        featuredVisible = entries.some(function (entry) { return entry.isIntersecting; });
        syncFeaturedTimer();
      }, { threshold: 0.1 });
      featuredObserver.observe(featuredCarousel);
    }
    syncFeaturedTimer();

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
    [featured, grid].forEach(function (container) {
      container.addEventListener("change", function (e) {
        if (e.target.matches("[data-variant-select],[data-quantity],[data-purchase-mode]")) updateProductCard(e.target.closest(".has-order-pricing"));
      });
      container.addEventListener("input", function (e) {
        if (e.target.matches("[data-quantity],[data-wholesale-amount]")) updateProductCard(e.target.closest(".has-order-pricing"));
      });
    });
    document.addEventListener("click", function (e) {
      var order = e.target.closest("[data-product-order]");
      if (order && order.dataset.soldOut === "true") {
        e.preventDefault();
        return;
      }
      if (order && order.dataset.invalidOrder === "true") {
        e.preventDefault();
        var card = order.closest(".has-order-pricing");
        var mode = $("[data-purchase-mode]", card);
        $(mode && mode.value === "wholesale" ? "[data-wholesale-amount]" : "[data-quantity]", card).focus();
        return;
      }
      if (e.target.closest("[data-needs-contact]")) $("#contact-notice").hidden = false;
    });
    render("all");

    /* ---------- Révélations ---------- */
    $$(".reveal").forEach(observe);

    /* ---------- Menu mobile ---------- */
    var burger = $("#burger"), menu = $("#menu"), nav = $("#nav");
    var setMenu = function (open) {
      menu.classList.toggle("open", open);
      nav.classList.toggle("menu-open", open);
      burger.setAttribute("aria-expanded", String(open));
      burger.setAttribute("aria-label", open ? "Fermer le menu" : "Ouvrir le menu");
      document.body.style.overflow = open ? "hidden" : "";
    };
    burger.addEventListener("click", function () { setMenu(!menu.classList.contains("open")); });
    menu.addEventListener("click", function (e) { if (e.target.closest("a")) setMenu(false); });
    document.addEventListener("keydown", function (e) { if (e.key === "Escape" && menu.classList.contains("open")) { setMenu(false); burger.focus(); } });

    /* ---------- Retour tactile 3D des appels à l'action ---------- */
    var pressTimers = new WeakMap();
    var animateButtonPress = function (button) {
      if (!button || button.disabled || button.getAttribute("aria-disabled") === "true" || reduce) return;
      button.classList.remove("is-pressed");
      void button.offsetWidth;
      button.classList.add("is-pressed");
      window.clearTimeout(pressTimers.get(button));
      pressTimers.set(button, window.setTimeout(function () {
        button.classList.remove("is-pressed");
        pressTimers.delete(button);
      }, 500));
    };
    document.addEventListener("pointerdown", function (e) {
      if (e.target.closest) animateButtonPress(e.target.closest(".btn"));
    });
    document.addEventListener("click", function (e) {
      if (e.detail === 0 && e.target.closest) animateButtonPress(e.target.closest(".btn"));
    });

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
