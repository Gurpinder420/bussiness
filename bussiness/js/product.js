/* =============================================================
   SARVAGUN NATURALS - product.js
   Gallery (thumbnails + hover zoom), variant switching, quantity
   stepper and the pincode check on product.html.
   ============================================================= */
(function () {
  "use strict";

  var layout = document.querySelector("[data-product]");
  if (!layout || !document.body.contains(document.querySelector(".pinfo"))) return;

  /* -------------------------------------------------- gallery */
  var mainImg = document.querySelector("[data-gallery-main]");
  var thumbs = Array.prototype.slice.call(document.querySelectorAll("[data-gallery-thumb]"));

  thumbs.forEach(function (thumb) {
    thumb.addEventListener("click", function () {
      if (!mainImg) return;
      var src = thumb.dataset.src;
      if (!src) return;
      mainImg.classList.remove("is-loaded");
      mainImg.src = src;
      mainImg.alt = thumb.dataset.alt || mainImg.alt;
      if (mainImg.complete) mainImg.classList.add("is-loaded");
      thumbs.forEach(function (t) { t.setAttribute("aria-pressed", String(t === thumb)); });
    });
  });

  if (mainImg) {
    var frame = mainImg.closest(".gallery__main");
    if (frame && window.matchMedia("(hover: hover)").matches) {
      frame.addEventListener("mouseenter", function () { frame.classList.add("is-zoomed"); });
      frame.addEventListener("mouseleave", function () {
        frame.classList.remove("is-zoomed");
        mainImg.style.transformOrigin = "center center";
      });
      frame.addEventListener("mousemove", function (e) {
        var r = frame.getBoundingClientRect();
        var x = ((e.clientX - r.left) / r.width) * 100;
        var y = ((e.clientY - r.top) / r.height) * 100;
        mainImg.style.transformOrigin = x + "% " + y + "%";
      });
    }
    /* keyboard users: Enter toggles zoom */
    frame && frame.addEventListener("keydown", function (e) {
      if (e.key === "Enter" || e.key === " ") {
        e.preventDefault();
        frame.classList.toggle("is-zoomed");
      }
    });
  }

  /* -------------------------------------------------- variants */
  function money(n) {
    if (window.SG && window.SG.money) return window.SG.money(n);
    return "\u20B9" + Number(n).toLocaleString("en-IN");
  }

  var priceNow = document.querySelector("[data-price-now]");
  var priceWas = document.querySelector("[data-price-was]");
  var saveTag = document.querySelector("[data-save]");
  var mobileNow = Array.prototype.slice.call(document.querySelectorAll("[data-mobile-price]"));

  function paintPrice(price, old) {
    if (priceNow) priceNow.textContent = money(price);
    if (priceWas) priceWas.textContent = old ? money(old) : "";
    if (saveTag) {
      if (old > price) {
        saveTag.hidden = false;
        saveTag.textContent = "Save " + money(old - price);
      } else {
        saveTag.hidden = true;
      }
    }
    mobileNow.forEach(function (el) { el.textContent = money(price); });
  }

  document.querySelectorAll("[data-variant]").forEach(function (chip) {
    chip.addEventListener("click", function () {
      var d = chip.dataset;
      layout.dataset.id = d.id;
      layout.dataset.name = d.name;
      layout.dataset.price = d.price;
      layout.dataset.oldPrice = d.oldPrice || "";
      layout.dataset.size = d.size;
      if (d.image) layout.dataset.image = d.image;
      if (mainImg && d.image) { mainImg.src = d.image; }
      document.querySelectorAll("[data-variant]").forEach(function (t) {
        t.setAttribute("aria-pressed", String(t === chip));
      });
      paintPrice(parseFloat(d.price), parseFloat(d.oldPrice || "0"));
      var mobileAdd = document.querySelector("[data-mobile-add]");
      if (mobileAdd) {
        mobileAdd.dataset.id = d.id;
        mobileAdd.dataset.name = d.name;
        mobileAdd.dataset.price = d.price;
        mobileAdd.dataset.oldPrice = d.oldPrice || "";
        mobileAdd.dataset.size = d.size;
        if (d.image) mobileAdd.dataset.image = d.image;
      }
      var sizeLabel = document.querySelector("[data-size-label]");
      if (sizeLabel) sizeLabel.textContent = d.size;
      var live = document.querySelector("[data-variant-live]");
      if (live) live.textContent = d.size + " selected, " + money(parseFloat(d.price));
    });
  });

  /* -------------------------------------------------- quantity */
  var qtyInput = document.querySelector("[data-qty-input]");
  if (qtyInput) {
    document.querySelectorAll("[data-qty-minus]").forEach(function (btn) {
      btn.addEventListener("click", function () {
        var v = Math.max(1, parseInt(qtyInput.value, 10) - 1 || 1);
        qtyInput.value = String(v);
      });
    });
    document.querySelectorAll("[data-qty-plus]").forEach(function (btn) {
      btn.addEventListener("click", function () {
        var v = Math.min(10, (parseInt(qtyInput.value, 10) || 1) + 1);
        qtyInput.value = String(v);
      });
    });
    qtyInput.addEventListener("change", function () {
      var v = parseInt(qtyInput.value, 10) || 1;
      qtyInput.value = String(Math.max(1, Math.min(10, v)));
    });
  }

  /* -------------------------------------------------- pincode check */
  var pinForm = document.querySelector("[data-pincode]");
  if (pinForm) {
    pinForm.addEventListener("submit", function (e) {
      e.preventDefault();
      var input = pinForm.querySelector('input[name="pincode"]');
      var out = document.querySelector("[data-pincode-result]");
      var value = (input.value || "").trim();
      if (!/^\d{6}$/.test(value)) {
        input.setAttribute("aria-invalid", "true");
        if (out) {
          out.className = "pincode__result is-warn";
          out.textContent = "Please enter a valid 6-digit Indian pincode.";
        }
        return;
      }
      input.setAttribute("aria-invalid", "false");
      if (out) {
        out.className = "pincode__result is-ok";
        out.textContent = "Pincode " + value + " is a valid Indian pincode format. " +
          "Live delivery dates and COD eligibility cannot be confirmed here - a courier serviceability API is not connected in this demo. " +
          "Orders are dispatched from a placeholder warehouse in 2-3 working days once a real one is set up.";
      }
      window.sgToast && window.sgToast("Pincode format accepted. Live serviceability needs a courier API.", "info");
    });
  }
})();
