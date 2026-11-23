/* =============================================================
   SARVAGUN NATURALS - main.js
   Site-wide interactions: page transitions, header behaviour,
   mobile nav, search, scroll reveals, count-up, sliders, accordions,
   toasts, form validation, blur-up images, back-to-top.
   No frameworks. Cart + currency logic lives in cart.js.
   ============================================================= */
(function () {
  "use strict";

  var reduced = window.matchMedia("(prefers-reduced-motion: reduce)");
  var prefersReduced = function () { return reduced.matches; };

  /* ---------------------------------------------------------- toasts */
  function toast(message, type) {
    var host = document.getElementById("toasts");
    if (!host) return;
    var el = document.createElement("div");
    el.className = "toast" + (type ? " toast--" + type : "");
    el.setAttribute("role", "status");
    el.textContent = message;
    host.appendChild(el);
    var life = setTimeout(dismiss, type === "error" ? 5200 : 3600);
    el.addEventListener("click", dismiss);
    function dismiss() {
      clearTimeout(life);
      el.classList.add("is-out");
      setTimeout(function () { el.remove(); }, 300);
    }
  }
  window.sgToast = toast;

  /* ---------------------------------------------------------- page transitions */
  var mainEl = document.querySelector("main");
  document.addEventListener("click", function (e) {
    var link = e.target.closest && e.target.closest("a");
    if (!link) return;
    if (e.metaKey || e.ctrlKey || e.shiftKey || e.altKey || e.button !== 0) return;
    if (link.target && link.target !== "_self") return;
    if (link.hasAttribute("download")) return;
    if (link.dataset.placeholderLink !== undefined) return; // handled below
    var href = link.getAttribute("href");
    if (!href || href.charAt(0) === "#" || href.indexOf("mailto:") === 0 || href.indexOf("tel:") === 0) return;
    var url = new URL(href, location.href);
    if (url.origin !== location.origin) return;
    if (!/\.html?$/.test(url.pathname) && url.pathname !== "/" ) return;
    if (url.pathname === location.pathname && url.search === location.search) return;
    if (prefersReduced() || !mainEl) return;
    e.preventDefault();
    mainEl.classList.add("is-leaving");
    setTimeout(function () { location.href = url.href; }, 240);
  });

  /* ---------------------------------------------------------- placeholder links */
  document.addEventListener("click", function (e) {
    var el = e.target.closest && e.target.closest("[data-placeholder-link]");
    if (!el) return;
    e.preventDefault();
    toast("Placeholder link - add your real profile or number in the HTML.", "info");
  });

  /* ---------------------------------------------------------- header + nav + search */
  var header = document.getElementById("siteHeader");
  var navToggle = document.querySelector("[data-nav-toggle]");
  var mobileNav = document.getElementById("mobileNav");
  var searchToggle = document.querySelector("[data-search-toggle]");
  var searchBar = document.getElementById("searchBar");

  function closeNav() {
    if (!mobileNav || mobileNav.hidden) return;
    mobileNav.hidden = true;
    if (navToggle) { navToggle.setAttribute("aria-expanded", "false"); navToggle.setAttribute("aria-label", "Open menu"); }
  }
  function closeSearch() {
    if (!searchBar || searchBar.hidden) return;
    searchBar.hidden = true;
    if (searchToggle) searchToggle.setAttribute("aria-expanded", "false");
  }

  if (navToggle && mobileNav) {
    navToggle.addEventListener("click", function () {
      var open = mobileNav.hidden;
      mobileNav.hidden = !open;
      navToggle.setAttribute("aria-expanded", String(open));
      navToggle.setAttribute("aria-label", open ? "Close menu" : "Open menu");
      if (open) closeSearch();
    });
  }
  if (searchToggle && searchBar) {
    searchToggle.addEventListener("click", function () {
      var open = searchBar.hidden;
      searchBar.hidden = !open;
      searchToggle.setAttribute("aria-expanded", String(open));
      if (open) {
        closeNav();
        var input = searchBar.querySelector("input");
        if (input) input.focus();
      }
    });
  }
  document.addEventListener("keydown", function (e) {
    if (e.key === "Escape") { closeNav(); closeSearch(); }
  });

  function onScrollHeader() {
    if (!header) return;
    header.classList.toggle("is-scrolled", window.scrollY > 8);
  }
  onScrollHeader();
  window.addEventListener("scroll", onScrollHeader, { passive: true });

  /* ---------------------------------------------------------- scroll reveals */
  var revealItems = Array.prototype.slice.call(document.querySelectorAll("[data-reveal]"));
  if ("IntersectionObserver" in window && !prefersReduced()) {
    var io = new IntersectionObserver(function (entries) {
      entries.forEach(function (entry) {
        if (entry.isIntersecting) {
          entry.target.classList.add("is-visible");
          io.unobserve(entry.target);
        }
      });
    }, { threshold: 0.12, rootMargin: "0px 0px -8% 0px" });
    revealItems.forEach(function (el) { io.observe(el); });
  } else {
    revealItems.forEach(function (el) { el.classList.add("is-visible"); });
  }

  /* ---------------------------------------------------------- count-up */
  function runCount(el) {
    var target = parseFloat(el.dataset.count);
    var suffix = el.dataset.suffix || "";
    var prefix = el.dataset.prefix || "";
    if (isNaN(target)) return;
    if (el.dataset.counted === "1") return;
    el.dataset.counted = "1";
    if (prefersReduced()) { el.textContent = prefix + target.toLocaleString("en-IN") + suffix; return; }
    var duration = 1200, start = null;
    function step(ts) {
      if (!start) start = ts;
      var p = Math.min((ts - start) / duration, 1);
      var eased = 1 - Math.pow(1 - p, 3);
      var val = Math.round(target * eased);
      el.textContent = prefix + val.toLocaleString("en-IN") + suffix;
      if (p < 1) requestAnimationFrame(step);
    }
    el.classList.add("is-counted");
    requestAnimationFrame(step);
  }
  var counters = Array.prototype.slice.call(document.querySelectorAll("[data-count]"));
  if (counters.length) {
    if ("IntersectionObserver" in window) {
      var co = new IntersectionObserver(function (entries) {
        entries.forEach(function (entry) {
          if (entry.isIntersecting) { runCount(entry.target); co.unobserve(entry.target); }
        });
      }, { threshold: 0.6 });
      counters.forEach(function (el) { co.observe(el); });
    } else {
      counters.forEach(runCount);
    }
  }

  /* ---------------------------------------------------------- hero parallax */
  var heroFrame = document.querySelector(".hero__frame");
  if (heroFrame && !prefersReduced()) {
    var ticking = false;
    window.addEventListener("scroll", function () {
      if (ticking) return;
      ticking = true;
      requestAnimationFrame(function () {
        var y = Math.min(window.scrollY, 600) * 0.045;
        heroFrame.style.setProperty("--py", (-y).toFixed(2) + "px");
        ticking = false;
      });
    }, { passive: true });
  }

  /* ---------------------------------------------------------- sliders */
  document.querySelectorAll("[data-slider]").forEach(function (slider) {
    var track = slider.querySelector(".slider__track");
    var prev = slider.querySelector("[data-slider-prev]");
    var next = slider.querySelector("[data-slider-next]");
    if (!track) return;
    function step(dir) {
      var card = track.querySelector(".quote-card, .tile");
      var amount = card ? card.getBoundingClientRect().width + 18 : track.clientWidth * 0.8;
      track.scrollBy({ left: dir * amount, behavior: prefersReduced() ? "auto" : "smooth" });
    }
    if (prev) prev.addEventListener("click", function () { step(-1); });
    if (next) next.addEventListener("click", function () { step(1); });
  });

  /* ---------------------------------------------------------- accordions */
  document.querySelectorAll("[data-acc]").forEach(function (btn) {
    var panel = document.getElementById(btn.getAttribute("aria-controls"));
    if (!panel) return;
    btn.addEventListener("click", function () {
      var open = btn.getAttribute("aria-expanded") === "true";
      btn.setAttribute("aria-expanded", String(!open));
      panel.hidden = open;
    });
  });

  /* ---------------------------------------------------------- back to top */
  var toTop = document.querySelector("[data-to-top]");
  if (toTop) {
    toTop.addEventListener("click", function () {
      window.scrollTo({ top: 0, behavior: prefersReduced() ? "auto" : "smooth" });
    });
    var toggleTop = function () {
      toTop.classList.toggle("is-visible", window.scrollY > 480);
    };
    toggleTop();
    window.addEventListener("scroll", toggleTop, { passive: true });
  }

  /* ---------------------------------------------------------- blur-up images */
  function markLoaded(img) {
    if (img.complete) { img.classList.add("is-loaded"); }
  }
  document.querySelectorAll("img.blur-up").forEach(function (img) {
    if (img.complete && img.naturalWidth > 0) { img.classList.add("is-loaded"); return; }
    img.addEventListener("load", function () { img.classList.add("is-loaded"); });
    img.addEventListener("error", function () { img.classList.add("is-loaded"); });
    setTimeout(function () { markLoaded(img); }, 3000);
  });

  /* sticky mobile add-to-cart bar needs room at the bottom of the page */
  if (document.querySelector(".mobile-buybar")) document.body.classList.add("has-buybar");

  /* ---------------------------------------------------------- year */
  document.querySelectorAll("[data-year]").forEach(function (el) {
    el.textContent = String(new Date().getFullYear());
  });

  /* ---------------------------------------------------------- validation helpers */
  var EMAIL_RE = /^[^\s@]+@[^\s@]+\.[a-z]{2,}$/i;
  var PHONE_RE = /^[6-9]\d{9}$/;       // Indian mobile: 10 digits starting 6-9
  function setError(field, msg) {
    var box = field.closest(".field");
    var out = box ? box.querySelector(".field__error") : null;
    if (out) out.textContent = msg || "";
    field.setAttribute("aria-invalid", msg ? "true" : "false");
    return !msg;
  }
  window.sgValidate = {
    email: EMAIL_RE,
    phone: PHONE_RE,
    setError: setError
  };

  /* ---------------------------------------------------------- newsletter */
  document.querySelectorAll("[data-newsletter]").forEach(function (form) {
    form.addEventListener("submit", function (e) {
      e.preventDefault();
      var input = form.querySelector('input[type="email"]');
      var msg = form.querySelector("[data-form-msg]");
      if (!input) return;
      var ok = EMAIL_RE.test(input.value.trim());
      if (!ok) {
        input.setAttribute("aria-invalid", "true");
        if (msg) { msg.textContent = "Please enter a valid email address."; msg.className = "form-note"; }
        return;
      }
      input.setAttribute("aria-invalid", "false");
      if (msg) {
        msg.textContent = "Thanks. This is a demo form - no email service is connected, so nothing was sent or stored.";
        msg.className = "form-note";
      }
      toast("Demo form only - no subscription was saved.", "info");
      form.reset();
    });
  });

  /* ---------------------------------------------------------- contact form */
  document.querySelectorAll("[data-contact-form]").forEach(function (form) {
    form.addEventListener("submit", function (e) {
      e.preventDefault();
      var name = form.querySelector('[name="name"]');
      var email = form.querySelector('[name="email"]');
      var phone = form.querySelector('[name="phone"]');
      var message = form.querySelector('[name="message"]');
      var valid = true;
      if (name) valid = setError(name, name.value.trim().length < 2 ? "Please tell us your name." : "") && valid;
      if (email) valid = setError(email, EMAIL_RE.test(email.value.trim()) ? "" : "Enter a valid email address.") && valid;
      if (phone && phone.value.trim()) valid = setError(phone, PHONE_RE.test(phone.value.trim()) ? "" : "Enter a 10-digit Indian mobile number.") && valid;
      if (message) valid = setError(message, message.value.trim().length < 10 ? "Please add at least 10 characters." : "") && valid;
      var out = form.querySelector("[data-form-status]");
      if (!valid) {
        if (out) { out.className = "notice"; out.textContent = "Please fix the highlighted fields and try again."; }
        return;
      }
      if (out) {
        out.className = "notice notice--sage";
        out.textContent = "Form checked. This demo has no backend, so your message was not sent - connect a form service (Formspree, Netlify Forms or your own endpoint) to receive enquiries.";
      }
      toast("Demo form - message not sent.", "info");
      form.reset();
    });
  });

  /* ---------------------------------------------------------- quick filter links (categories page) */

})();
