(function () {
  "use strict";

  var $ = function (selector, context) { return (context || document).querySelector(selector); };
  var escapeHTML = function (value) {
    return String(value == null ? "" : value).replace(/[&<>"']/g, function (character) {
      return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[character];
    });
  };
  var slug = function (value) {
    return value.normalize("NFD").replace(/[\u0300-\u036f]/g, "")
      .toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
  };
  var categories = [
    ["croustillant", "Croustillant"],
    ["graines", "Graines"],
    ["maison", "Maison"]
  ];
  var setupPanel = $("#setup-panel");
  var loginPanel = $("#login-panel");
  var dashboard = $("#dashboard");
  var loginMessage = $("#login-message");
  var saveMessage = $("#save-message");
  var settingsForm = $("#settings-form");

  function setMessage(element, message, state) {
    element.textContent = message;
    element.dataset.state = state || "";
  }

  function variantEditor(variant) {
    variant = variant || {};
    var value = function (field) { return escapeHTML(variant[field]); };
    var checked = variant.available === false ? "" : " checked";
    return '<fieldset class="admin-variant">' +
      '<div class="admin-variant-heading"><strong>Option</strong><button class="admin-remove" type="button" data-remove-variant>Supprimer</button></div>' +
      '<div class="admin-variant-grid">' +
      '<label>Nom de l’option<input data-variant-field="name" value="' + value("name") + '" required></label>' +
      '<label>Recette / précision (facultatif)<input data-variant-field="recipe" value="' + value("recipe") + '"></label>' +
      '<label>Prix de détail (FCFA)<input data-variant-field="retailPrice" type="number" min="0" step="1" value="' + value("retailPrice") + '"></label>' +
      '<label>Unité<input data-variant-field="retailUnit" value="' + value("retailUnit") + '" placeholder="unité"></label>' +
      '<label class="admin-upload">Photo<input data-variant-field="image" value="' + value("image") + '" placeholder="assets/img/..."><input data-upload-variant type="file" accept="image/jpeg,image/png,image/webp,image/gif"></label>' +
      '<label class="admin-check"><input data-variant-field="available" type="checkbox"' + checked + '> Disponible à la vente</label>' +
      '</div></fieldset>';
  }

  function productEditor(product) {
    product = product || {};
    var categoryOptions = categories.map(function (category) {
      return '<option value="' + category[0] + '"' + (product.cat === category[0] ? " selected" : "") + '>' + category[1] + '</option>';
    }).join("");
    var checked = product.available === false ? "" : " checked";
    var variants = Array.isArray(product.variants) ? product.variants : [];
    return '<article class="admin-product" data-product>' +
      '<div class="admin-product-heading"><h3>' + escapeHTML(product.name || "Nouveau produit") + '</h3><button class="admin-remove" type="button" data-remove-product>Supprimer le produit</button></div>' +
      '<div class="admin-product-grid">' +
      '<label>Nom du produit<input data-field="name" value="' + escapeHTML(product.name) + '" required></label>' +
      '<label>Catégorie<select data-field="cat" required>' + categoryOptions + '</select></label>' +
      '<label>Description<textarea data-field="desc">' + escapeHTML(product.desc) + '</textarea></label>' +
      '<label>Offre ou information spéciale<textarea data-field="offer" placeholder="Facultatif">' + escapeHTML(product.offer) + '</textarea></label>' +
      '<label>Prix (FCFA)<input data-field="price" type="number" min="0" step="1" value="' + escapeHTML(product.price) + '"></label>' +
      '<label>Unité<input data-field="unit" value="' + escapeHTML(product.unit) + '" placeholder="unité"></label>' +
      '<label class="admin-upload">Photo<input data-field="image" value="' + escapeHTML(product.image) + '" placeholder="assets/img/..."><input data-upload-product type="file" accept="image/jpeg,image/png,image/webp,image/gif"></label>' +
      '<label class="admin-check"><input data-field="available" type="checkbox"' + checked + '> Disponible à la vente</label>' +
      '</div><div class="admin-variants"><strong>Options et variantes</strong><div data-variant-list>' +
      variants.map(variantEditor).join("") + '</div>' +
      '<button class="btn btn-ghost admin-add-variant" type="button" data-add-variant>Ajouter une option</button></div></article>';
  }

  function renderProducts(products) {
    $("#product-list").innerHTML = products.map(productEditor).join("");
    $("#product-list").querySelectorAll("[data-field=name]").forEach(function (input) {
      input.addEventListener("input", function () {
        input.closest("[data-product]").querySelector(".admin-product-heading h3").textContent = input.value || "Nouveau produit";
      });
    });
  }

  function readNumber(input, label) {
    if (!input.value.trim()) return null;
    var value = Number(input.value);
    if (!Number.isSafeInteger(value) || value < 0) {
      throw new Error('Vérifiez le champ « ' + label + ' » : indiquez un nombre entier positif.');
    }
    return value;
  }

  function collectContent() {
    var phoneCall = settingsForm.elements.phoneCall.value.trim();
    var phoneWhatsapp = settingsForm.elements.phoneWhatsapp.value.trim();
    if (!/^\d{8,15}$/.test(phoneCall) || !/^\d{8,15}$/.test(phoneWhatsapp)) {
      throw new Error("Les deux numéros doivent contenir de 8 à 15 chiffres, avec l’indicatif du pays.");
    }
    var products = Array.from($("#product-list").querySelectorAll("[data-product]")).map(function (card) {
      var field = function (name) { return $('[data-field="' + name + '"]', card); };
      var name = field("name").value.trim();
      if (!name || !slug(name)) throw new Error("Chaque produit doit avoir un nom valide.");
      var product = {
        id: slug(name),
        name: name,
        cat: field("cat").value,
        desc: field("desc").value.trim(),
        offer: field("offer").value.trim(),
        price: readNumber(field("price"), "prix"),
        unit: field("unit").value.trim() || null,
        image: field("image").value.trim() || null,
        available: field("available").checked
      };
      var variantCards = Array.from(card.querySelectorAll("[data-variant-list] .admin-variant"));
      if (variantCards.length) {
        product.variants = variantCards.map(function (variantCard) {
          var variantField = function (key) { return $('[data-variant-field="' + key + '"]', variantCard); };
          var variantName = variantField("name").value.trim();
          if (!variantName || !slug(variantName)) throw new Error('Une option du produit « ' + name + ' » doit avoir un nom.');
          var retailPrice = readNumber(variantField("retailPrice"), "prix de l’option");
          if (retailPrice === null) throw new Error('Indiquez le prix de chaque option du produit « ' + name + ' ».');
          return {
            id: slug(variantName),
            name: variantName,
            recipe: variantField("recipe").value.trim() || null,
            retailPrice: retailPrice,
            retailUnit: variantField("retailUnit").value.trim() || null,
            image: variantField("image").value.trim() || null,
            available: variantField("available").checked
          };
        });
        var variantIds = product.variants.map(function (variant) { return variant.id; });
        if (new Set(variantIds).size !== variantIds.length) {
          throw new Error('Les options du produit « ' + name + ' » doivent avoir des noms différents.');
        }
      }
      return product;
    });
    var productIds = products.map(function (product) { return product.id; });
    if (new Set(productIds).size !== productIds.length) throw new Error("Chaque produit doit avoir un nom différent.");
    return { phoneCall: phoneCall, phoneWhatsapp: phoneWhatsapp, products: products };
  }

  async function api(path, options) {
    var response = await fetch(path, Object.assign({ credentials: "same-origin", cache: "no-store" }, options || {}));
    var result = await response.json().catch(function () { return {}; });
    if (!response.ok) throw new Error(result.error || "Erreur du serveur (" + response.status + ")");
    return result;
  }

  async function showDashboard() {
    var content = await api("/api/catalog");
    settingsForm.elements.phoneCall.value = content.phoneCall || "";
    settingsForm.elements.phoneWhatsapp.value = content.phoneWhatsapp || "";
    renderProducts(Array.isArray(content.products) ? content.products : []);
    loginPanel.hidden = true;
    dashboard.hidden = false;
    setMessage(saveMessage, "", "");
  }

  function showSetupIfMissing(error) {
    if (error.message.includes("404") || error.message.includes("Failed to fetch") ||
        error.message.includes("NetworkError")) {
      setupPanel.hidden = false;
      loginPanel.hidden = true;
    }
  }

  if (window.location.protocol === "file:") {
    setupPanel.hidden = false;
    loginPanel.hidden = true;
    return;
  }

  api("/api/auth/session").then(function (result) {
    if (result.authenticated) return showDashboard();
  }).catch(function (error) {
    showSetupIfMissing(error);
    if (!setupPanel.hidden) return;
    setMessage(loginMessage, "Impossible de vérifier la connexion : " + error.message, "error");
  });

  $("#login-form").addEventListener("submit", async function (event) {
    event.preventDefault();
    var password = event.currentTarget.elements.password.value;
    setMessage(loginMessage, "Connexion en cours…", "");
    try {
      await api("/api/auth/login", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ password: password })
      });
      event.currentTarget.reset();
      await showDashboard();
    } catch (error) {
      showSetupIfMissing(error);
      setMessage(loginMessage, error.message, "error");
    }
  });

  $("#logout-button").addEventListener("click", async function () {
    try {
      await api("/api/auth/logout", { method: "POST" });
      dashboard.hidden = true;
      loginPanel.hidden = false;
      setMessage(loginMessage, "Vous êtes déconnectée.", "success");
    } catch (error) {
      setMessage(saveMessage, "Déconnexion impossible : " + error.message, "error");
    }
  });

  $("#add-product").addEventListener("click", function () {
    $("#product-list").insertAdjacentHTML("beforeend", productEditor({ cat: "croustillant" }));
    var input = $("#product-list [data-product]:last-child [data-field=name]");
    input.focus();
    input.addEventListener("input", function () {
      input.closest("[data-product]").querySelector(".admin-product-heading h3").textContent = input.value || "Nouveau produit";
    });
  });

  $("#product-list").addEventListener("click", function (event) {
    var addVariant = event.target.closest("[data-add-variant]");
    if (addVariant) {
      addVariant.closest("[data-product]").querySelector("[data-variant-list]")
        .insertAdjacentHTML("beforeend", variantEditor());
      return;
    }
    var removeProduct = event.target.closest("[data-remove-product]");
    if (removeProduct) {
      removeProduct.closest("[data-product]").remove();
      return;
    }
    var removeVariant = event.target.closest("[data-remove-variant]");
    if (removeVariant) removeVariant.closest(".admin-variant").remove();
  });

  $("#product-list").addEventListener("change", async function (event) {
    var input = event.target;
    if (!input.matches("[data-upload-product], [data-upload-variant]") || !input.files.length) return;
    var card = input.closest("[data-product], .admin-variant");
    var imageField = card.querySelector('[data-field="image"], [data-variant-field="image"]');
    var file = input.files[0];
    if (file.size > 2 * 1024 * 1024) {
      setMessage(saveMessage, "La photo doit peser 2 Mo ou moins.", "error");
      input.value = "";
      return;
    }
    setMessage(saveMessage, "Envoi de la photo vers le dépôt…", "");
    try {
      var base64 = await new Promise(function (resolve, reject) {
        var reader = new FileReader();
        reader.onerror = function () { reject(new Error("Lecture du fichier image impossible.")); };
        reader.onload = function () { resolve(String(reader.result).split(",")[1]); };
        reader.readAsDataURL(file);
      });
      var result = await api("/api/images", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ name: file.name.replace(/\.[^.]+$/, ""), type: file.type, content: base64 })
      });
      imageField.value = result.path;
      setMessage(saveMessage, "Photo ajoutée. Enregistrez le catalogue pour l’afficher sur le site.", "success");
    } catch (error) {
      setMessage(saveMessage, "Envoi de la photo impossible : " + error.message, "error");
    } finally {
      input.value = "";
    }
  });

  settingsForm.addEventListener("submit", async function (event) {
    event.preventDefault();
    setMessage(saveMessage, "Enregistrement du catalogue…", "");
    try {
      var content = collectContent();
      var result = await api("/api/catalog", {
        method: "PUT",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(content)
      });
      var status = "Catalogue enregistré dans GitHub. Le déploiement automatique va commencer.";
      if (result.url) status += " Commit : " + result.url;
      setMessage(saveMessage, status, "success");
    } catch (error) {
      setMessage(saveMessage, "Enregistrement impossible : " + error.message, "error");
    }
  });
})();
