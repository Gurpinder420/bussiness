# SARVAGUN NATURALS — static storefront

Pure Nature. Honest Origins.

A complete, animated, responsive 13-page e-commerce front end built with **HTML5, CSS3 and vanilla JavaScript only** — no frameworks, no build step, no dependencies.

Open `index.html` in a browser, or serve the folder (`python3 -m http.server`) and start clicking.

---

## 1. What is in the box

```
sarvagun-naturals/
├── index.html              home (hero, trust, categories, bestsellers, story,
│                           gift banner, video tiles, samples, newsletter, social)
├── shop.html               all 13 products: category + price filters, search,
│                           sort, quick view, add to cart
├── product.html            gallery + zoom, size variants, quantity, reviews tab,
│                           pincode check, related products, mobile buy bar
├── categories.html         the five ranges with a buying guide
├── about.html              brand story, values, sourcing journey, claims policy
├── contact.html            validated form, support details, FAQ accordion, WhatsApp
├── cart.html               line items, quantity, coupon, free-shipping progress
├── checkout.html           validated address form, COD order, gateway notice
├── track-order.html        order lookup + honest status timeline
├── privacy-policy.html     starter text (legal review required)
├── refund-policy.html      starter text (legal review required)
├── shipping-policy.html    starter text (legal review required)
├── terms.html              starter text (legal review required)
├── css/
│   ├── style.css           design tokens, layout, components (~1,100 lines)
│   ├── animations.css      all keyframes, reveals, reduced-motion handling
│   └── responsive.css      1536 / 1280 / 1024 / 768 / 480 / 360 + print
├── js/
│   ├── main.js             page transitions, header, nav, search, reveals,
│   │                       count-up, slider, accordion, toasts, validation,
│   │                       blur-up images, back-to-top
│   ├── cart.js             cart in localStorage, drawer, currency, wishlist,
│   │                       cart page, checkout summary, orders, tracking
│   ├── shop.js             filters, sorting, search, quick-view modal
│   └── product.js          gallery, zoom, variants, quantity, pincode check
├── sitemap.xml
├── robots.txt
└── README.md
```

Every page shares the same announcement ticker, sticky header, cart drawer, footer, WhatsApp button, toasts and back-to-top control.

---

## 2. Products are written in HTML, not in JavaScript

This is deliberate. Each product card and each price is literal markup in `shop.html`, `index.html` and `product.html`. There is no catalogue array anywhere in `js/`.

To change a product, edit the HTML:

```html
<article class="product-card" data-product
         data-id="ghee-500"                 <!-- unique id, used by the cart  -->
         data-name="A2 Gir Cow Ghee - 500 ml"
         data-price="899"                   <!-- INR, integer, no symbols      -->
         data-old-price="1099"              <!-- 0 or omit for no strike price -->
         data-image="images/ghee-500.jpg"
         data-category="ghee"               <!-- ghee | honey | superfoods |
                                                 spices | gifts               -->
         data-size="500 ml">
  ...
  <span class="price__now" data-inr="899">&#8377;899</span>
  <s class="price__was" data-inr="1099">&#8377;1,099</s>
</article>
```

- `data-price` / `data-old-price` drive the cart; `data-inr` on a price element is what the currency switcher converts.
- If you change a price in one place, change it in the other too — or delete `data-inr` from a *new* element and let the page show plain text.
- The discount badge is plain text (`18% off`); update it by hand.

The product page's size variants are buttons in `product.html`:

```html
<button class="chip" data-variant data-id="ghee-1000" data-name="A2 Gir Cow Ghee - 1 L"
        data-price="1649" data-old-price="1999" data-size="1 L"
        data-image="images/ghee-1l.jpg" aria-pressed="false">1 L</button>
```

---

## 3. Replacing the placeholder images

All images point at `placehold.co`, and their `alt` text says "Placeholder image…". To use real photographs:

1. Create an `images/` folder next to `index.html`.
2. Replace each `src="https://placehold.co/…"` with `src="images/your-photo.jpg"`.
3. Keep `width` and `height` on every `<img>` (prevents layout shift) and keep `loading="lazy"` except on the hero image, which should keep `fetchpriority="high"`.
4. Keep the `blur-up` class — the blur-in effect and the `is-loaded` flag are automatic.
5. For responsive sources add `srcset` and `sizes`, for example:

```html
<img src="images/ghee-600.jpg"
     srcset="images/ghee-400.jpg 400w, images/ghee-600.jpg 600w, images/ghee-1200.jpg 1200w"
     sizes="(max-width: 767px) 45vw, 300px"
     width="600" height="600" alt="A2 Gir Cow Ghee in a glass jar" loading="lazy" class="blur-up">
```

6. Update the `alt` text to describe the real photo, and delete the word "Placeholder" from it.
7. Update the `og:image` / `twitter:image` URLs in every page's `<head>` (a 1200×630 crop works best).

Product photographs for ghee and honey read best on a warm neutral background, shot slightly from above, with a plain backdrop and no props that suggest a certification.

---

## 4. Contact details, social links, WhatsApp

Search and replace these placeholders everywhere in the HTML:

| Placeholder | Where |
|---|---|
| `hello@example.com` | header/footer, contact, policy pages |
| `+91 00000 00000` / `tel:+910000000000` | footer, contact |
| `https://wa.me/910000000000` | floating WhatsApp button, footer, contact |
| `Placeholder address, India` | footer, contact, policy tables |
| `https://sarvagunnaturals.example` | canonical tags, Open Graph, `sitemap.xml`, `robots.txt`, JSON-LD |
| `href="#"` with `data-placeholder-link` | social links in the footer and the social tiles on the home page |

`data-placeholder-link` makes the link show a toast instead of navigating; remove that attribute once the real URL is in place.

The placeholder phone number in the WhatsApp link is intentionally fake — replace it, or the button will open a chat with nobody.

---

## 5. Payments — what is and is not wired up

**Cash on Delivery works.** It records an order in your browser (`localStorage`, key `sg_orders_v1`) and gives you an order number like `SG-20260812-A1B2` that you can paste into the tracking page.

**Online payment is deliberately disabled.** No gateway is installed, no card fields exist anywhere in the markup, and the "Card / UPI / Netbanking" option explains this instead of pretending to charge you.

To make online payment real you need server-side code, not just front-end edits:

1. **Razorpay (INR)**
   - Server: `POST /api/orders` → `razorpay.orders.create({ amount: paise, currency: "INR", receipt })`, then return `order_id`.
   - Front end: open Razorpay Checkout with that `order_id`.
   - Server: on success verify `razorpay_signature` with HMAC-SHA256 of `order_id|payment_id` and your **secret key** (never in the browser), then mark the order paid.
2. **Stripe (international cards)**
   - Server: create a Checkout Session or PaymentIntent; return a `client_secret` or a hosted URL.
   - Serve the webhook endpoint, and treat the `payment_intent.succeeded` webhook — not the redirect — as proof of payment.
3. Re-price the cart on the server from your own database. **Never trust `data-price` from the browser**, and never trust the coupon either.
4. Verify stock, then email the order.

Until that exists, keep the online option disabled. Do not add a fake "payment successful" screen.

---

## 6. Currency switcher

- INR is the charging currency and the default display.
- USD, GBP, EUR, AED and SAR are **display only**. Rates come from the public `https://open.er-api.com/v6/latest/INR` endpoint at runtime (no API key needed).
- If that request fails (offline, blocked, rate-limited) prices stay in ₹ and a toast says so. **No rate is ever hard-coded**, so you never show a stale fake price.
- The chosen currency is remembered in `localStorage` (`sg_currency_v1`).
- To swap in a paid provider, edit `loadRates()` in `js/cart.js` — everything else reads `currency.rates`.

---

## 7. Cart, coupons, shipping

- Cart lives in `localStorage` under `sg_cart_v1`; the wishlist is `sg_wish_v1`; the applied coupon is `sg_coupon_v1`.
- Free shipping above **₹2,000**, otherwise a flat **₹99** (constants `FREE_ABOVE` and `SHIP_FLAT` at the top of `js/cart.js`).
- One demo coupon: `WELCOME10` = 10% off, defined in the `COUPONS` object in `js/cart.js`. It is checked in the browser only — **validate coupons on the server before charging**.
- The cart badge bounces, the drawer slides in, and Add to Cart flies the product image to the cart button (all skipped under `prefers-reduced-motion`).

---

## 8. Honest-content rules this build follows

Please keep them when you edit:

- No claim of organic, chemical-free, lab-tested or certified status; no certification logos; no health or medical claims. Add them **only** when you hold the papers, and then add them with the certificate number.
- No invented reviews, ratings or customer counts. Testimonials on the home page are labelled "Sample text"; the product page states plainly that there are no verified reviews and shows no stars. The `Product` JSON-LD has **no** `aggregateRating` — add it only with real review data.
- Placeholder images are labelled as placeholders, in the `alt` text and in the visible copy.
- Policy pages carry a notice that they are starter text for a legal professional to review.
- Order tracking states that live statuses need a courier API and only the "placed" step is real.
- The checkout says what it actually does: records the order locally, takes no money, books no courier.

---

## 9. Accessibility and performance notes

- Semantic landmarks, one `<h1>` per page, skip-to-content link, visible `:focus-visible` rings, `aria-expanded` / `aria-pressed` / `aria-current` on interactive controls, `aria-live` for results and toasts, labels on every input, `alt` on every image.
- The cart drawer is a labelled `role="dialog"` with a focus loop and Escape to close.
- Animations use only `transform` and `opacity`; `prefers-reduced-motion: reduce` switches off the marquee, parallax, fly-to-cart, reveals and transitions.
- Images lazy-load below the fold; the hero is high priority; no web-font blocking beyond Google Fonts.
- Tested in Chromium at 1440, 1024, 768, 390 and 360 px wide with no horizontal scrolling.

---

## 10. Deploying

Any static host works, because there is no build step.

**Netlify** — drag the folder onto <https://app.netlify.com/drop>, or connect the repo with: build command *(none)*, publish directory `.`.

**Vercel** — `vercel deploy --prod` from inside the folder, framework preset **Other**, output directory `.`.

**GitHub Pages** — push the folder to a repo, then Settings → Pages → deploy from branch, folder `/ (root)`.

**Any shared host / cPanel** — upload the whole folder to `public_html` and keep the structure.

**Local check before you upload:**

```bash
cd sarvagun-naturals
python3 -m http.server 8000
# open http://localhost:8000
```

After deploying, replace `https://sarvagunnaturals.example` in every canonical tag, in `sitemap.xml`, in `robots.txt` and in the JSON-LD with your real domain, then submit `sitemap.xml` in Google Search Console.

---

## 11. Known limits (on purpose)

| Area | Status | What is needed |
|---|---|---|
| Online payment | Disabled, explained in the UI | Razorpay/Stripe + server |
| Order storage | This browser only | A database + backend API |
| Live tracking | Only "order placed" is real | Courier/logistics API |
| Pincode serviceability | Format check only | Courier serviceability API |
| Newsletter & contact form | Validate, then say nothing was sent | Formspree / Netlify Forms / your endpoint |
| Reviews & ratings | Sample text only | A review system with verification |
| Exchange rates | Live public feed, INR fallback | Nothing, or a paid rate feed |
| Policies | Starter text | A legal professional |

---

## 12. Where to change the look

All colours, radii, shadows and fonts are CSS variables at the top of `css/style.css`:

```css
--green: #173F35;      /* royal forest green */
--emerald: #164B3C;
--gold: #D6B46A;       /* champagne gold   */
--gold-deep: #A9812F;  /* gold for text on light backgrounds (WCAG AA) */
--ivory: #FFFDF5;
--cream: #F4EBDD;
--sage: #DCE7D9;
--charcoal: #252923;
--purple: #4B2E83;     /* optional accent, used sparingly */
```

Headings use Cormorant Garamond and body text Poppins, both loaded from Google Fonts in each page's `<head>`.
