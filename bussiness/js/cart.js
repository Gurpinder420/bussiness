/* =============================================================
   SARVAGUN NATURALS - cart.js
   localStorage cart + currency display + wishlist + drawer +
   cart page + checkout summary + order/tracking helpers.

   IMPORTANT (read before going live):
   - Prices and coupons are validated in the browser only. On a real
     store the server must re-price every line item and re-validate the
     coupon before charging.
   - No payment gateway is connected. Online payment is intentionally
     disabled; Cash on Delivery just records an order locally.
   ============================================================= */
(function () {
  "use strict";

  var KEY_CART = "sg_cart_v1";
  var KEY_WISH = "sg_wish_v1";
  var KEY_CUR = "sg_currency_v1";
  var KEY_COUPON = "sg_coupon_v1";
  var KEY_ORDERS = "sg_orders_v1";

  /* main.js owns the toast UI and exposes it as window.sgToast */
  function toast(message, type) {
    if (window.sgToast) window.sgToast(message, type);
  }

  var FREE_ABOVE = 2000;   // free shipping threshold, in INR
  var SHIP_FLAT = 99;      // flat shipping fee, in INR

  /* Browser-side demo coupons. Replace with a server-side lookup. */
  var COUPONS = {
    WELCOME10: { type: "percent", value: 10, label: "10% off your order" }
  };

  /* ---------------------------------------------------------- storage */
  function read(key, fallback) {
    try {
      var raw = localStorage.getItem(key);
      return raw ? JSON.parse(raw) : fallback;
    } catch (err) { return fallback; }
  }
  function write(key, value) {
    try { localStorage.setItem(key, JSON.stringify(value)); } catch (err) {}
  }
  function num(n) { return isFinite(n) ? Number(n) : 0; }

  /* ---------------------------------------------------------- currency */
  var CURRENCIES = {
    INR: { symbol: "\u20B9", decimals: 0, indian: true },
    USD: { symbol: "$", decimals: 2 },
    GBP: { symbol: "\u00A3", decimals: 2 },
    EUR: { symbol: "\u20AC", decimals: 2 },
    AED: { symbol: "AED ", decimals: 2 },
    SAR: { symbol: "SAR ", decimals: 2 }
  };
  var currency = {
    code: read(KEY_CUR, "INR"),
    rates: null,          // populated by the live exchange-rate API
    status: "pending"     // pending | live | fallback
  };
  if (!CURRENCIES[currency.code]) currency.code = "INR";

  /* Live rates: https://open.er-api.com/v6/latest/INR (free, no key).
     Rates are "units of target currency per 1 INR". If the request fails
     we stay on INR - we never invent a rate. */
  function loadRates() {
    if (currency.code === "INR") { currency.status = "live"; return Promise.resolve(); }
    return fetch("https://open.er-api.com/v6/latest/INR", { cache: "no-store" })
      .then(function (res) { return res.json(); })
      .then(function (data) {
        if (data && data.rates && typeof data.rates.USD === "number") {
          currency.rates = data.rates;
          currency.status = "live";
        } else {
          currency.status = "fallback";
        }
      })
      .catch(function () { currency.status = "fallback"; })
      .then(function () {
        if (currency.status === "fallback") {
          toast("Live exchange rates are unavailable right now, so prices stay in INR (\u20B9).", "info");
        }
        renderAll();
      });
  }

  function inrFormat(amount) {
    var neg = amount < 0;
    var n = Math.round(Math.abs(amount));
    var s = String(n);
    if (s.length > 3) {
      var head = s.slice(0, -3);
      var tail = s.slice(-3);
      head = head.replace(/\B(?=(\d{2})+(?!\d))/g, ",");
      s = head + "," + tail;
    }
    return (neg ? "-" : "") + "\u20B9" + s;
  }

  /* Convert + format an INR amount for display. */
  function money(inrAmount, forceCode) {
    var code = forceCode || currency.code;
    var conf = CURRENCIES[code] || CURRENCIES.INR;
    var amount = num(inrAmount);
    if (code === "INR" || !currency.rates || typeof currency.rates[code] !== "number") {
      return inrFormat(amount);
    }
    var converted = amount * currency.rates[code];
    return conf.symbol + converted.toLocaleString("en-US", {
      minimumFractionDigits: conf.decimals,
      maximumFractionDigits: conf.decimals
    });
  }

  /* ---------------------------------------------------------- cart state */
  var items = read(KEY_CART, []);
  if (!Array.isArray(items)) items = [];
  var coupon = read(KEY_COUPON, null);

  function save() { write(KEY_CART, items); }
  function persistCoupon() { write(KEY_COUPON, coupon); }

  function findItem(id) {
    for (var i = 0; i < items.length; i++) { if (items[i].id === id) return items[i]; }
    return null;
  }

  function addItem(item, qty) {
    qty = Math.max(1, parseInt(qty, 10) || 1);
    var existing = findItem(item.id);
    if (existing) {
      existing.qty = Math.min(99, existing.qty + qty);
    } else {
      items.push({
        id: item.id,
        name: item.name,
        size: item.size || "",
        price: num(item.price),
        oldPrice: num(item.oldPrice),
        image: item.image || "",
        qty: Math.min(99, qty)
      });
    }
    save();
    renderAll();
    bumpBadge();
    toast(item.name + " added to cart.");
  }

  function removeItem(id) {
    items = items.filter(function (i) { return i.id !== id; });
    save();
    renderAll();
  }

  function setQty(id, qty) {
    var item = findItem(id);
    if (!item) return;
    item.qty = Math.max(0, Math.min(99, parseInt(qty, 10) || 0));
    if (item.qty === 0) { removeItem(id); return; }
    save();
    renderAll();
  }

  function qtyOf(id) { var i = findItem(id); return i ? i.qty : 0; }

  function count() {
    return items.reduce(function (n, i) { return n + i.qty; }, 0);
  }
  function subtotal() {
    return items.reduce(function (n, i) { return n + i.price * i.qty; }, 0);
  }

  /* ---------------------------------------------------------- totals */
  function totals() {
    var sub = subtotal();
    var discount = 0;
    if (coupon && COUPONS[coupon]) {
      var c = COUPONS[coupon];
      if (c.type === "percent") discount = Math.round(sub * c.value / 100);
    }
    if (discount > sub) discount = sub;
    var net = sub - discount;
    var shipping = items.length === 0 ? 0 : (net >= FREE_ABOVE ? 0 : SHIP_FLAT);
    return {
      subtotal: sub,
      discount: discount,
      shipping: shipping,
      total: net + shipping,
      coupon: coupon,
      couponLabel: coupon && COUPONS[coupon] ? COUPONS[coupon].label : ""
    };
  }

  /* ---------------------------------------------------------- wishlist */
  var wish = read(KEY_WISH, []);
  if (!Array.isArray(wish)) wish = [];

  function inWish(id) { return wish.some(function (w) { return w.id === id; }); }

  function toggleWish(item) {
    if (inWish(item.id)) {
      wish = wish.filter(function (w) { return w.id !== item.id; });
      toast(item.name + " removed from wishlist.", "info");
    } else {
      wish.push({ id: item.id, name: item.name, size: item.size || "", price: num(item.price), image: item.image || "" });
      toast(item.name + " saved to wishlist.");
    }
    write(KEY_WISH, wish);
    renderWishlist();
  }

  function renderWishlist() {
    document.querySelectorAll("[data-wishlist-count]").forEach(function (el) {
      el.textContent = String(wish.length);
      el.hidden = wish.length === 0;
    });
    document.querySelectorAll("[data-wishlist-toggle]").forEach(function (btn) {
      var pressed = inWish(btn.dataset.id);
      btn.setAttribute("aria-pressed", String(pressed));
    });
  }

  /* ---------------------------------------------------------- drawer */
  var drawer = document.getElementById("cartDrawer");
  var overlay = document.querySelector("[data-overlay]");
  var drawerItems = document.querySelector("[data-cart-drawer-items]");
  var drawerFoot = document.querySelector("[data-cart-drawer-foot]");
  var drawerTitle = document.getElementById("cartDrawerTitle");
  var lastFocus = null;
  var drawerMode = "cart";

  function openDrawer(mode) {
    if (!drawer) return;
    drawerMode = mode || "cart";
    lastFocus = document.activeElement;
    renderDrawer();
    drawer.classList.add("is-open");
    drawer.setAttribute("aria-hidden", "false");
    if (overlay) { overlay.hidden = false; requestAnimationFrame(function () { overlay.classList.add("is-open"); }); }
    var first = drawer.querySelector("[data-cart-close]");
    if (first) first.focus();
  }

  function closeDrawer() {
    if (!drawer) return;
    drawer.classList.remove("is-open");
    drawer.setAttribute("aria-hidden", "true");
    if (overlay) {
      overlay.classList.remove("is-open");
      setTimeout(function () { overlay.hidden = true; }, 300);
    }
    if (lastFocus && lastFocus.focus) lastFocus.focus();
  }

  function drawerFootHtml() {
    var t = totals();
    var html = "";
    html += '<div class="row"><span>Subtotal</span><span>' + money(t.subtotal) + "</span></div>";
    if (t.discount > 0) {
      html += '<div class="row"><span>Coupon ' + t.coupon + "</span><span>-" + money(t.discount) + "</span></div>";
    }
    html += '<div class="row"><span>Shipping</span><span>' + (t.shipping === 0 ? "Free" : money(t.shipping)) + "</span></div>";
    html += '<div class="row row--total"><span>Total</span><span>' + money(t.total) + "</span></div>";
    html += '<a class="btn btn--primary btn--block" href="checkout.html">Checkout</a>';
    html += '<a class="btn btn--outline btn--block" href="cart.html">View cart</a>';
    html += '<p class="form-note" style="margin:.6rem 0 0">Taxes included as shown. Amounts are charged in INR; other currencies are display-only via a live rate.</p>';
    return html;
  }

  function renderDrawer() {
    if (!drawer || !drawerItems || !drawerFoot) return;

    if (drawerMode === "wishlist") {
      if (drawerTitle) drawerTitle.textContent = "Your wishlist";
      if (!wish.length) {
        drawerItems.innerHTML = '<div class="empty-state"><h3>Nothing saved yet</h3><p>Tap the heart on any product to keep it here.</p><a class="btn btn--outline" href="shop.html">Browse products</a></div>';
        drawerFoot.innerHTML = "";
        return;
      }
      drawerItems.innerHTML = wish.map(function (w) {
        return '<div class="line-item">' +
          (w.image ? '<img class="line-item__img" src="' + w.image + '" alt="" width="72" height="72" loading="lazy">' : '<div class="line-item__img"></div>') +
          '<div><p class="line-item__title">' + w.name + "</p>" +
          '<p class="line-item__meta">' + w.size + "</p>" +
          '<button class="btn btn--sm btn--outline" type="button" data-wish-to-cart="' + w.id + '">Move to cart</button></div>' +
          '<div><button class="line-remove" type="button" data-wish-remove="' + w.id + '">Remove</button></div>' +
          "</div>";
      }).join("");
      drawerFoot.innerHTML = '<a class="btn btn--primary btn--block" href="shop.html">Continue shopping</a>';
      return;
    }

    if (drawerTitle) drawerTitle.textContent = "Your cart";
    if (!items.length) {
      drawerItems.innerHTML = '<div class="empty-state"><h3>Your cart is empty</h3><p>Add a jar of bilona ghee or forest honey to get started.</p><a class="btn btn--outline" href="shop.html">Start shopping</a></div>';
      drawerFoot.innerHTML = '<p class="form-note" style="margin:0">Free shipping on orders above ' + money(FREE_ABOVE) + ".</p>";
      return;
    }
    drawerItems.innerHTML = items.map(function (i) {
      return '<div class="line-item">' +
        (i.image ? '<img class="line-item__img" src="' + i.image + '" alt="' + i.name + '" width="72" height="72" loading="lazy">' : '<div class="line-item__img"></div>') +
        "<div>" +
          '<p class="line-item__title">' + i.name + "</p>" +
          '<p class="line-item__meta">' + i.size + "</p>" +
          '<div class="qty">' +
            '<button type="button" data-qty="dec" data-id="' + i.id + '" aria-label="Decrease quantity of ' + i.name + '">&minus;</button>' +
            "<output>" + i.qty + "</output>" +
            '<button type="button" data-qty="inc" data-id="' + i.id + '" aria-label="Increase quantity of ' + i.name + '">+</button>' +
          "</div>" +
        "</div>" +
        "<div>" +
          '<p class="line-item__price">' + money(i.price * i.qty) + "</p>" +
          (i.qty > 1 ? '<p class="line-item__meta">' + money(i.price) + " each</p>" : "") +
          '<button class="line-remove" type="button" data-remove data-id="' + i.id + '">Remove</button>' +
        "</div>" +
        "</div>";
    }).join("");
    drawerFoot.innerHTML = drawerFootHtml();
  }

  function bumpBadge() {
    document.querySelectorAll("[data-cart-count]").forEach(function (el) {
      el.classList.remove("is-bumping");
      void el.offsetWidth;
      el.classList.add("is-bumping");
    });
  }

  function renderBadge() {
    document.querySelectorAll("[data-cart-count]").forEach(function (el) {
      var n = count();
      el.textContent = String(n);
      el.hidden = false;
    });
    var cartBtn = document.querySelector("[data-cart-open]");
    if (cartBtn) cartBtn.setAttribute("aria-label", "Open cart, " + count() + " item" + (count() === 1 ? "" : "s"));
  }

  /* ---------------------------------------------------------- cart page */
  function renderCartPage() {
    var lineHost = document.querySelector("[data-cart-lines]");
    if (!lineHost) return;
    var sumHost = document.querySelector("[data-cart-summary]");
    var t = totals();

    if (!items.length) {
      lineHost.innerHTML = '<div class="empty-state"><h3>Your cart is empty</h3><p>Browse the shop and add something you like.</p><a class="btn btn--primary" href="shop.html">Shop all products</a></div>';
      if (sumHost) sumHost.innerHTML = '<h2>Order summary</h2><p class="muted">Nothing to total yet.</p><a class="btn btn--outline btn--block" href="shop.html">Browse products</a>';
      return;
    }

    lineHost.innerHTML = '<div class="order-lines">' + items.map(function (i) {
      return '<div class="line-item">' +
        (i.image ? '<img class="line-item__img" src="' + i.image + '" alt="' + i.name + '" width="64" height="64" loading="lazy">' : '<div class="line-item__img"></div>') +
        "<div><p class=\"line-item__title\">" + i.name + "</p>" +
        '<p class="line-item__meta">' + i.size + (i.qty > 1 ? " &middot; " + money(i.price) + " each" : "") + "</p>" +
        '<div class="qty">' +
          '<button type="button" data-qty="dec" data-id="' + i.id + '" aria-label="Decrease quantity of ' + i.name + '">&minus;</button>' +
          '<output aria-label="Quantity">' + i.qty + "</output>" +
          '<button type="button" data-qty="inc" data-id="' + i.id + '" aria-label="Increase quantity of ' + i.name + '">+</button>' +
        "</div></div>" +
        "<div><p class=\"line-item__price\">" + money(i.price * i.qty) + "</p>" +
        '<button class="line-remove" type="button" data-remove data-id="' + i.id + '">Remove</button></div>' +
        "</div>";
    }).join("") + "</div>";

    if (sumHost) {
      var pct = Math.min(100, Math.round(t.subtotal - t.discount <= 0 ? 100 : ((t.subtotal - t.discount) / FREE_ABOVE) * 100));
      sumHost.innerHTML = "<h2>Order summary</h2>" +
        '<div class="row"><span>Subtotal (' + count() + " item" + (count() === 1 ? "" : "s") + ")</span><span>" + money(t.subtotal) + "</span></div>" +
        (t.discount > 0 ? '<div class="row"><span>Coupon ' + t.coupon + "</span><span>-" + money(t.discount) + "</span></div>" : "") +
        '<div class="row"><span>Shipping</span><span>' + (t.shipping === 0 ? "Free" : money(t.shipping)) + "</span></div>" +
        '<div class="row row--total"><span>Total</span><span>' + money(t.total) + "</span></div>" +
        '<div class="free-ship-bar" aria-hidden="true"><span style="width:' + pct + '%"></span></div>' +
        '<p class="summary__note">' + ((t.subtotal - t.discount) >= FREE_ABOVE
          ? "Free shipping applied."
          : "Add " + money(FREE_ABOVE - (t.subtotal - t.discount)) + " more for free shipping.") + "</p>" +
        '<div class="coupon">' +
          '<label class="visually-hidden" for="couponInput">Coupon code</label>' +
          '<input id="couponInput" type="text" placeholder="Coupon code" value="' + (t.coupon || "") + '" autocomplete="off">' +
          '<button class="btn btn--outline" type="button" data-apply-coupon>Apply</button>' +
        "</div>" +
        '<p class="summary__note">Demo coupon: WELCOME10 (10% off). Coupons are checked in the browser only - validate them on the server before charging.</p>' +
        '<a class="btn btn--primary btn--block" href="checkout.html">Proceed to checkout</a>' +
        '<a class="btn btn--outline btn--block" href="shop.html">Continue shopping</a>';
    }
  }

  /* ---------------------------------------------------------- price refresh */
  function renderPrices() {
    document.querySelectorAll("[data-inr]").forEach(function (el) {
      var v = num(el.dataset.inr);
      el.textContent = money(v);
    });
  }

  function renderAll() {
    renderBadge();
    renderPrices();
    renderDrawer();
    renderCartPage();
    renderCheckoutSummary();
    renderWishlist();
  }

  /* ---------------------------------------------------------- checkout */
  function renderCheckoutSummary() {
    var host = document.querySelector("[data-checkout-summary]");
    if (!host) return;
    var t = totals();
    if (!items.length) {
      host.innerHTML = "<h2>Order summary</h2><p class=\"muted\">Your cart is empty.</p><a class=\"btn btn--outline btn--block\" href=\"shop.html\">Shop products</a>";
      return;
    }
    host.innerHTML = "<h2>Order summary</h2>" +
      '<ul class="order-lines">' + items.map(function (i) {
        return '<li class="line-item">' +
          (i.image ? '<img class="line-item__img" src="' + i.image + '" alt="" width="64" height="64" loading="lazy">' : '<div class="line-item__img"></div>') +
          '<div><p class="line-item__title">' + i.name + "</p><p class=\"line-item__meta\">" + i.size + " &middot; qty " + i.qty + "</p></div>" +
          '<p class="line-item__price">' + money(i.price * i.qty) + "</p>" +
          "</li>";
      }).join("") + "</ul>" +
      '<div class="row"><span>Subtotal</span><span>' + money(t.subtotal) + "</span></div>" +
      (t.discount > 0 ? '<div class="row"><span>Coupon ' + t.coupon + "</span><span>-" + money(t.discount) + "</span></div>" : "") +
      '<div class="row"><span>Shipping</span><span>' + (t.shipping === 0 ? "Free" : money(t.shipping)) + "</span></div>" +
      '<div class="row row--total"><span>Total payable</span><span>' + money(t.total) + "</span></div>" +
      '<p class="summary__note">Charged in INR. Cash on Delivery is the only working payment option in this demo.</p>';
  }

  function makeOrderNo() {
    var d = new Date();
    var stamp = d.getFullYear() + String(d.getMonth() + 1).padStart(2, "0") + String(d.getDate()).padStart(2, "0");
    return "SG-" + stamp + "-" + Math.random().toString(36).slice(2, 6).toUpperCase();
  }

  function initCheckout() {
    var form = document.getElementById("checkoutForm");
    if (!form) return;
    var status = form.querySelector("[data-form-status]");

    form.addEventListener("submit", function (e) {
      e.preventDefault();
      if (!items.length) {
        if (status) { status.className = "notice"; status.textContent = "Your cart is empty - add a product first."; }
        return;
      }
      var required = [
        ["name", function (v) { return v.trim().length >= 2 || "Enter your full name."; }],
        ["email", function (v) { return /^[^\s@]+@[^\s@]+\.[a-z]{2,}$/i.test(v.trim()) || "Enter a valid email address."; }],
        ["phone", function (v) { return /^[6-9]\d{9}$/.test(v.trim()) || "Enter a 10-digit Indian mobile number."; }],
        ["address", function (v) { return v.trim().length >= 10 || "Enter your full street address."; }],
        ["city", function (v) { return v.trim().length >= 2 || "Enter your city."; }],
        ["state", function (v) { return v.trim().length >= 2 || "Enter your state."; }],
        ["pincode", function (v) { return /^\d{6}$/.test(v.trim()) || "Enter a 6-digit pincode."; }]
      ];
      var firstBad = null;
      required.forEach(function (pair) {
        var input = form.querySelector('[name="' + pair[0] + '"]');
        if (!input) return;
        var result = pair[1](input.value || "");
        var ok = result === true;
        var box = input.closest(".field");
        var err = box ? box.querySelector(".field__error") : null;
        if (err) err.textContent = ok ? "" : result;
        input.setAttribute("aria-invalid", ok ? "false" : "true");
        if (!ok && !firstBad) firstBad = input;
      });

      var terms = form.querySelector('[name="terms"]');
      if (terms && !terms.checked) {
        if (status) { status.className = "notice"; status.textContent = "Please accept the terms and policies before placing an order."; }
        if (!firstBad) firstBad = terms;
      }
      if (firstBad) { firstBad.focus(); if (status) status.className = "notice"; return; }

      var t = totals();
      var buyer = {};
      ["name", "email", "phone", "address", "city", "state", "pincode", "notes"].forEach(function (k) {
        var el = form.querySelector('[name="' + k + '"]');
        buyer[k] = el ? el.value.trim() : "";
      });
      var payment = form.querySelector('[name="payment"]:checked');
      var method = payment ? payment.value : "cod";

      var order = {
        number: makeOrderNo(),
        placedAt: new Date().toISOString(),
        method: method === "online" ? "online" : "cod",
        items: items.slice(),
        totals: { subtotal: t.subtotal, discount: t.discount, shipping: t.shipping, total: t.total, coupon: t.coupon },
        buyer: buyer,
        status: "placed"
      };

      var orders = read(KEY_ORDERS, []);
      if (!Array.isArray(orders)) orders = [];
      orders.unshift(order);
      write(KEY_ORDERS, orders.slice(0, 25));

      items = [];
      coupon = null;
      save();
      persistCoupon();
      renderAll();

      var done = document.getElementById("orderConfirmation");
      if (done) {
        done.hidden = false;
        var box = done.querySelector("[data-order-number]");
        if (box) box.textContent = order.number;
        var totalBox = done.querySelector("[data-order-total]");
        if (totalBox) totalBox.textContent = money(order.totals.total) + " (payable in cash on delivery)";
        var trackLink = done.querySelector("[data-order-track]");
        if (trackLink) trackLink.setAttribute("href", "track-order.html?order=" + encodeURIComponent(order.number));
        done.scrollIntoView({ behavior: "smooth", block: "center" });
      }
      form.hidden = true;
      toast("Order recorded. Pay cash when it arrives.");
    });

    var online = form.querySelectorAll('[data-online-payment]');
    online.forEach(function (btn) {
      btn.addEventListener("click", function () {
        if (status) {
          status.className = "notice";
          status.innerHTML = "<strong>Online payment is not connected yet.</strong> No gateway keys are installed, so no card, UPI or wallet payment can be taken and no payment should be attempted. Add Razorpay (INR) or Stripe (international) on the server, create the order there and verify the signature before enabling this button. Until then please use Cash on Delivery.";
        }
        toast("Online payment is not connected - use Cash on Delivery.", "error");
      });
    });
  }

  /* ---------------------------------------------------------- order tracking */
  function initTrack() {
    var form = document.getElementById("trackForm");
    if (!form) return;
    var result = document.getElementById("trackResult");

    function render(order) {
      if (!result) return;
      if (!order) {
        result.hidden = false;
        result.className = "notice";
        result.innerHTML = "<strong>No local order found with that number.</strong> Orders placed in this browser are stored on this device only. If you ordered on another device, tracking would need a real order database and a courier API - neither is connected in this demo.";
        return;
      }
      var steps = [
        ["Order placed", new Date(order.placedAt).toLocaleString("en-IN")],
        ["Packed", "Pending"],
        ["Shipped", "Pending"],
        ["Out for delivery", "Pending"],
        ["Delivered", "Pending"]
      ];
      result.hidden = false;
      result.className = "panel";
      result.innerHTML = "<h2>Order " + order.number + "</h2>" +
        '<p class="muted">Placed ' + new Date(order.placedAt).toLocaleString("en-IN") + " &middot; " +
        (order.method === "cod" ? "Cash on Delivery" : "Online (not paid)") + " &middot; " + money(order.totals.total) + "</p>" +
        '<ul class="timeline">' + steps.map(function (s, i) {
          return '<li class="' + (i === 0 ? "is-done" : "") + '"><strong>' + s[0] + "</strong><span>" + s[1] + "</span></li>";
        }).join("") + "</ul>" +
        '<p class="form-note" style="margin-top:1rem">Only the first status is real: this demo has no shipping or logistics API, so packed, shipped, out-for-delivery and delivered updates cannot be shown. Connect a courier API (or update statuses manually) before promising live tracking.</p>';

      var summary = order.items.map(function (i) {
        return i.name + " " + i.size + " &times; " + i.qty;
      }).join(", ");
      result.insertAdjacentHTML("beforeend", '<p class="muted" style="font-size:.85rem">Items: ' + summary + "</p>");
    }

    form.addEventListener("submit", function (e) {
      e.preventDefault();
      var input = form.querySelector('[name="order"]');
      var errBox = form.querySelector("[data-form-status]");
      var value = (input.value || "").trim().toUpperCase();
      if (!/^SG-\d{8}-[A-Z0-9]{4}$/.test(value)) {
        if (errBox) { errBox.className = "notice"; errBox.textContent = "Order numbers look like SG-20250131-A1B2. Check the number in your confirmation."; }
        if (input) input.setAttribute("aria-invalid", "true");
        return;
      }
      if (errBox) { errBox.textContent = ""; errBox.className = ""; }
      if (input) input.setAttribute("aria-invalid", "false");
      var orders = read(KEY_ORDERS, []);
      var found = Array.isArray(orders) ? orders.filter(function (o) { return o.number === value; })[0] : null;
      render(found || null);
    });

    /* deep link: track-order.html?order=SG-... */
    var param = new URLSearchParams(location.search).get("order");
    if (param) {
      var input2 = form.querySelector('[name="order"]');
      if (input2) { input2.value = param.toUpperCase(); }
      var orders2 = read(KEY_ORDERS, []);
      var found2 = Array.isArray(orders2) ? orders2.filter(function (o) { return o.number === param.toUpperCase(); })[0] : null;
      render(found2 || null);
    }
  }

  /* ---------------------------------------------------------- add-to-cart + fly effect */
  function productData(el) {
    var host = el.closest("[data-product]") || el.closest("[data-id]");
    if (!host) return null;
    return {
      id: host.dataset.id,
      name: host.dataset.name,
      price: num(host.dataset.price),
      oldPrice: num(host.dataset.oldPrice),
      image: host.dataset.image,
      size: host.dataset.size || ""
    };
  }

  function flyToCart(sourceImg, targetBtn) {
    if (!sourceImg || !targetBtn || !sourceImg.getBoundingClientRect) return;
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    var s = sourceImg.getBoundingClientRect();
    var t = targetBtn.getBoundingClientRect();
    var ghost = document.createElement("img");
    ghost.src = sourceImg.currentSrc || sourceImg.src;
    ghost.alt = "";
    ghost.className = "fly-img";
    ghost.style.left = s.left + "px";
    ghost.style.top = s.top + "px";
    ghost.style.width = Math.min(s.width, 160) + "px";
    ghost.style.height = Math.min(s.height, 160) + "px";
    ghost.style.borderRadius = "14px";
    document.body.appendChild(ghost);
    var dx = t.left + t.width / 2 - (s.left + Math.min(s.width, 160) / 2);
    var dy = t.top + t.height / 2 - (s.top + Math.min(s.height, 160) / 2);
    requestAnimationFrame(function () {
      ghost.style.transform = "translate(" + dx + "px," + dy + "px) scale(.12)";
      ghost.style.opacity = "0.15";
    });
    setTimeout(function () { ghost.remove(); }, 820);
    targetBtn.classList.add("cart-pulse");
    setTimeout(function () { targetBtn.classList.remove("cart-pulse"); }, 900);
  }

  document.addEventListener("click", function (e) {
    /* add to cart */
    var addBtn = e.target.closest("[data-add-to-cart]");
    if (addBtn) {
      e.preventDefault();
      var data = productData(addBtn);
      if (!data) return;
      var qtyInput = document.querySelector("[data-qty-input]");
      var qty = 1;
      if (qtyInput) {
        var qtyHost = qtyInput.closest("[data-product]");
        var qtyId = qtyHost ? qtyHost.dataset.id : null;
        if (!qtyId || qtyId === data.id) qty = parseInt(qtyInput.value, 10) || 1;
      }
      addItem(data, qty || 1);
      var scope = addBtn.closest(".product-card, .pinfo, [data-product]");
      var img = scope ? scope.querySelector("img") : null;
      var cartBtn = document.querySelector("[data-cart-open]");
      flyToCart(img, cartBtn);
      return;
    }

    /* buy now */
    var buyBtn = e.target.closest("[data-buy-now]");
    if (buyBtn) {
      e.preventDefault();
      var d2 = productData(buyBtn);
      if (d2) addItem(d2, 1);
      location.href = "checkout.html";
      return;
    }

    /* qty +/- */
    var qtyBtn = e.target.closest("[data-qty]");
    if (qtyBtn) {
      e.preventDefault();
      var id = qtyBtn.dataset.id;
      var dir = qtyBtn.dataset.qty;
      var current = qtyOf(id);
      setQty(id, dir === "inc" ? current + 1 : current - 1);
      return;
    }

    /* remove */
    var removeBtn = e.target.closest("[data-remove]");
    if (removeBtn) {
      e.preventDefault();
      removeItem(removeBtn.dataset.id);
      return;
    }

    /* cart open / close */
    if (e.target.closest("[data-cart-open]")) { e.preventDefault(); openDrawer("cart"); return; }
    if (e.target.closest("[data-cart-close]")) { e.preventDefault(); closeDrawer(); return; }
    if (e.target.closest("[data-wishlist-open]")) {
      e.preventDefault();
      if (!wish.length) { toast("Your wishlist is empty - tap a heart to save a product.", "info"); }
      openDrawer("wishlist");
      return;
    }
    if (e.target.closest("[data-overlay]")) { closeDrawer(); return; }

    /* wishlist toggle on cards */
    var wishBtn = e.target.closest("[data-wishlist-toggle]");
    if (wishBtn) {
      e.preventDefault();
      var wdata = productData(wishBtn);
      if (wdata) toggleWish(wdata);
      return;
    }

    /* wishlist -> cart */
    var toCart = e.target.closest("[data-wish-to-cart]");
    if (toCart) {
      e.preventDefault();
      var w = wish.filter(function (x) { return x.id === toCart.dataset.wishToCart; })[0];
      if (w) { addItem(w, 1); wish = wish.filter(function (x) { return x.id !== w.id; }); write(KEY_WISH, wish); renderAll(); }
      drawerMode = "cart";
      renderDrawer();
      return;
    }
    var wRemove = e.target.closest("[data-wish-remove]");
    if (wRemove) {
      e.preventDefault();
      wish = wish.filter(function (x) { return x.id !== wRemove.dataset.wishRemove; });
      write(KEY_WISH, wish);
      renderAll();
      return;
    }

    /* coupon */
    var applyBtn = e.target.closest("[data-apply-coupon]");
    if (applyBtn) {
      e.preventDefault();
      var input = document.getElementById("couponInput");
      var code = input ? input.value.trim().toUpperCase() : "";
      if (!code) { coupon = null; persistCoupon(); renderAll(); toast("Coupon removed.", "info"); return; }
      if (COUPONS[code]) {
        coupon = code;
        persistCoupon();
        renderAll();
        toast("Coupon " + code + " applied: " + COUPONS[code].label);
      } else {
        coupon = null;
        persistCoupon();
        renderAll();
        toast("That coupon code is not recognised.", "error");
      }
      return;
    }
  });

  /* keyboard: Escape closes drawer, focus trap-ish behaviour */
  document.addEventListener("keydown", function (e) {
    if (e.key === "Escape" && drawer && drawer.classList.contains("is-open")) closeDrawer();
    if (e.key === "Tab" && drawer && drawer.classList.contains("is-open")) {
      var focusables = drawer.querySelectorAll('a[href], button:not([disabled]), input, select, textarea');
      if (!focusables.length) return;
      var first = focusables[0];
      var last = focusables[focusables.length - 1];
      if (e.shiftKey && document.activeElement === first) { e.preventDefault(); last.focus(); }
      else if (!e.shiftKey && document.activeElement === last) { e.preventDefault(); first.focus(); }
    }
  });

  /* ---------------------------------------------------------- currency selector */
  function initCurrency() {
    var selects = document.querySelectorAll("[data-currency]");
    if (!selects.length) return;
    /* a matching selector inside the mobile nav, if present */
    selects.forEach(function (sel) {
      sel.value = currency.code;
      sel.addEventListener("change", function () {
        var code = sel.value;
        if (!CURRENCIES[code]) code = "INR";
        currency.code = code;
        write(KEY_CUR, code);
        selects.forEach(function (other) { other.value = code; });
        if (code === "INR") {
          currency.status = "live";
          renderAll();
          toast("Showing prices in Indian Rupees.");
        } else {
          loadRates();
          toast("Loading live exchange rates for " + code + "\u2026", "info");
        }
      });
    });
    if (currency.code !== "INR") loadRates();
  }

  /* ---------------------------------------------------------- boot */
  function boot() {
    renderAll();
    initCurrency();
    initCheckout();
    initTrack();
    /* keep multiple tabs in sync */
    window.addEventListener("storage", function (ev) {
      if (ev.key === KEY_CART) { items = read(KEY_CART, []); renderAll(); }
      if (ev.key === KEY_WISH) { wish = read(KEY_WISH, []); renderAll(); }
    });
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", boot);
  } else {
    boot();
  }

  /* public API */
  window.SG = {
    money: money,
    add: addItem,
    remove: removeItem,
    setQty: setQty,
    count: count,
    subtotal: subtotal,
    totals: totals,
    items: function () { return items.slice(); },
    currency: currency,
    orders: function () { return read(KEY_ORDERS, []); },
    refresh: renderAll
  };
})();
