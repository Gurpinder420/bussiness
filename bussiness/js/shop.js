/* =============================================================
   SARVAGUN NATURALS - shop.js
   Category / price / search filters, sorting and the quick-view modal.
   The catalogue itself lives in shop.html as real markup - this file
   only shows, hides and reorders existing cards.
   ============================================================= */
(function () {
  "use strict";

  var grid = document.getElementById("shopGrid");
  if (!grid) return;

  var cards = Array.prototype.slice.call(grid.querySelectorAll("[data-product]")).map(function (el, index) {
    return {
      el: el,
      id: el.dataset.id,
      cat: el.dataset.category,
      price: parseFloat(el.dataset.price) || 0,
      name: (el.querySelector(".product-card__name") || {}).textContent || "",
      size: el.dataset.size || "",
      image: el.dataset.image || "",
      pop: parseInt(el.dataset.pop, 10) || (100 - index),
      isNew: el.dataset.new === "1",
      index: index
    };
  });

  var countHost = document.querySelector("[data-result-count]");
  var emptyHost = document.querySelector("[data-shop-empty]");
  var searchInput = document.querySelector("[data-shop-search]");
  var sortSelect = document.querySelector("[data-sort]");
  var priceInput = document.querySelector("[data-max-price]");
  var priceLabel = document.querySelector("[data-price-label]");
  var catChips = Array.prototype.slice.call(document.querySelectorAll("[data-filter-cat]"));
  var resetBtn = document.querySelector("[data-filter-reset]");
  var filtersPanel = document.getElementById("shopFilters");
  var filtersToggle = document.querySelector("[data-filters-toggle]");

  var state = {
    cat: "all",
    q: "",
    maxPrice: priceInput ? parseFloat(priceInput.max) : Infinity,
    sort: "featured"
  };
  var hardMax = state.maxPrice;

  /* -------------------------------------------------- url params */
  var params = new URLSearchParams(location.search);
  if (params.get("cat")) state.cat = params.get("cat");
  if (params.get("q")) state.q = params.get("q");
  if (searchInput && state.q) searchInput.value = state.q;

  /* -------------------------------------------------- apply */
  function apply() {
    var shown = 0;
    var q = state.q.trim().toLowerCase();

    cards.forEach(function (c) {
      var okCat = state.cat === "all" || c.cat === state.cat;
      var okPrice = c.price <= state.maxPrice;
      var okText = !q || (c.name + " " + c.size + " " + c.cat).toLowerCase().indexOf(q) > -1;
      var visible = okCat && okPrice && okText;
      c.el.hidden = !visible;
      if (visible) shown++;
    });

    var list = cards.filter(function (c) { return !c.el.hidden; });
    list.sort(function (a, b) {
      switch (state.sort) {
        case "price-asc": return a.price - b.price;
        case "price-desc": return b.price - a.price;
        case "new": return (b.isNew ? 1 : 0) - (a.isNew ? 1 : 0) || a.index - b.index;
        case "name": return a.name.localeCompare(b.name);
        case "featured":
        default: return b.pop - a.pop || a.index - b.index;
      }
    });
    list.forEach(function (c) { grid.appendChild(c.el); });

    if (countHost) {
      countHost.textContent = shown === 0 ? "No products match these filters" :
        "Showing " + shown + " of " + cards.length + " products";
    }
    if (emptyHost) emptyHost.hidden = shown !== 0;
    if (priceLabel) priceLabel.textContent = "\u20B9" + Math.round(state.maxPrice).toLocaleString("en-IN");

    catChips.forEach(function (chip) {
      chip.setAttribute("aria-pressed", String(chip.dataset.filterCat === state.cat));
    });
  }

  /* -------------------------------------------------- events */
  catChips.forEach(function (chip) {
    chip.addEventListener("click", function () {
      state.cat = chip.dataset.filterCat;
      apply();
    });
  });

  if (searchInput) {
    searchInput.addEventListener("input", function () {
      state.q = searchInput.value;
      apply();
    });
  }
  if (sortSelect) {
    state.sort = sortSelect.value || "featured";
    sortSelect.addEventListener("change", function () {
      state.sort = sortSelect.value;
      apply();
    });
  }
  if (priceInput) {
    priceInput.addEventListener("input", function () {
      state.maxPrice = parseFloat(priceInput.value) || hardMax;
      apply();
    });
  }
  if (resetBtn) {
    resetBtn.addEventListener("click", function () {
      state = { cat: "all", q: "", maxPrice: hardMax, sort: "featured" };
      if (searchInput) searchInput.value = "";
      if (priceInput) priceInput.value = String(hardMax);
      if (sortSelect) sortSelect.value = "featured";
      apply();
      window.sgToast && window.sgToast("Filters cleared.", "info");
    });
  }
  if (filtersToggle && filtersPanel) {
    filtersToggle.addEventListener("click", function () {
      var open = filtersPanel.classList.toggle("is-open");
      filtersToggle.setAttribute("aria-expanded", String(open));
    });
  }

  apply();

  /* -------------------------------------------------- quick view modal */
  var modal = document.getElementById("quickView");
  var modalBody = modal ? modal.querySelector("[data-quick-body]") : null;
  var modalCloseBtn = modal ? modal.querySelector("[data-quick-close]") : null;
  var lastFocus = null;

  function money(n) {
    if (window.SG && window.SG.money) return window.SG.money(n);
    return "\u20B9" + Number(n).toLocaleString("en-IN");
  }

  function openModal(card) {
    if (!modal || !modalBody) return;
    lastFocus = document.activeElement;
    var price = parseFloat(card.dataset.price) || 0;
    var old = parseFloat(card.dataset.oldPrice) || 0;
    var nameEl = card.querySelector(".product-card__name");
    var catEl = card.querySelector(".product-card__cat");
    var imgEl = card.querySelector("img");
    var off = old > price ? Math.round((old - price) * 100 / old) : 0;

    modalBody.innerHTML =
      '<div class="quick-grid">' +
        '<div><img src="' + (card.dataset.image || "") + '" alt="' +
          (imgEl ? imgEl.alt : "Product image") + '" width="480" height="480"></div>' +
        "<div>" +
          '<p class="eyebrow">' + (catEl ? catEl.textContent : "") + "</p>" +
          "<h2>" + (nameEl ? nameEl.textContent : "") + "</h2>" +
          '<p class="muted">' + (card.dataset.size || "") + "</p>" +
          '<div class="price"><span class="price__now">' + money(price) + "</span>" +
            (off ? "<s class=\"price__was\">" + money(old) + "</s><span class=\"badge-row\"><span>" + off + "% off</span></span>" : "") +
          "</div>" +
          '<p class="muted" style="font-size:.9rem">' +
            "A smaller jar or pack of the same product is listed in the shop. Read the full product page for ingredients, storage and shipping details." +
          "</p>" +
          '<div class="pinfo__actions">' +
            '<button class="btn btn--primary" type="button" data-add-to-cart>Add to cart</button>' +
            '<a class="btn btn--outline" href="product.html">Full details</a>' +
          "</div>" +
          '<p class="form-note">Prices are in INR. Card and gateway details are not collected anywhere in this demo.</p>' +
        "</div>" +
      "</div>";

    /* the modal body needs the product data for the add-to-cart handler */
    var holder = modalBody.querySelector("[data-add-to-cart]");
    if (holder) {
      holder.setAttribute("data-id", card.dataset.id);
      holder.setAttribute("data-name", card.dataset.name);
      holder.setAttribute("data-price", card.dataset.price);
      holder.setAttribute("data-old-price", card.dataset.oldPrice);
      holder.setAttribute("data-image", card.dataset.image);
      holder.setAttribute("data-size", card.dataset.size || "");
    }
    modal.classList.add("is-open");
    modal.setAttribute("aria-hidden", "false");
    if (modalCloseBtn) modalCloseBtn.focus();
  }

  function closeModal() {
    if (!modal) return;
    modal.classList.remove("is-open");
    modal.setAttribute("aria-hidden", "true");
    if (lastFocus && lastFocus.focus) lastFocus.focus();
  }

  grid.addEventListener("click", function (e) {
    var qv = e.target.closest("[data-quick-view]");
    if (!qv) return;
    e.preventDefault();
    openModal(qv.closest("[data-product]"));
  });

  if (modalCloseBtn) modalCloseBtn.addEventListener("click", closeModal);
  if (modal) {
    modal.addEventListener("click", function (e) {
      if (e.target === modal) closeModal();
    });
    document.addEventListener("keydown", function (e) {
      if (e.key === "Escape" && modal.classList.contains("is-open")) closeModal();
    });
  }

  /* clicking a category chip deep-linked from the footer clears old text search */
  window.addEventListener("popstate", function () {
    var p = new URLSearchParams(location.search);
    state.cat = p.get("cat") || "all";
    state.q = p.get("q") || "";
    if (searchInput) searchInput.value = state.q;
    apply();
  });
})();
