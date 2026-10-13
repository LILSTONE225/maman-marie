(function () {
  "use strict";

  var loadMain = function () {
    var script = document.createElement("script");
    script.src = "assets/js/main.js";
    script.onerror = function () {
      console.error("Impossible de charger le script principal du site.");
    };
    document.body.appendChild(script);
  };

  if (window.location.protocol === "file:") {
    loadMain();
    return;
  }

  fetch("data/catalog.json", { cache: "no-store" })
    .then(function (response) {
      if (!response.ok) throw new Error("Le catalogue publié est indisponible (" + response.status + ").");
      return response.json();
    })
    .then(function (catalog) {
      if (!catalog || !Array.isArray(catalog.products)) throw new Error("Le catalogue publié est invalide.");
      window.SITE_CONFIG = Object.assign({}, window.SITE_CONFIG, catalog);
    })
    .catch(function (error) {
      console.error("Le catalogue administré n’a pas pu être chargé.", error);
      var notice = document.getElementById("contact-notice");
      if (notice) {
        notice.hidden = false;
        notice.textContent = "Le catalogue ne s’est pas actualisé. Contactez-nous pour confirmer les prix et disponibilités.";
      }
    })
    .then(loadMain);
})();
