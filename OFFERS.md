# Offers and order rules

Managed from **/#admin → Offres** (super admin, or managers with the "manage products" permission).

| Feature | Where it shows | Admin setting |
|---|---|---|
| Minimum order | Cart blocks checkout, server rejects (HTTP 422) | Règles & paliers |
| Reward ladder (progress bar) | Cart drawer, PreOrder modal | Règles & paliers |
| Volume prices | Product card, cart, Quick Order | Prix par volume (per product) |
| Cross-sell "Complétez votre commande" | Cart drawer | Produits associés (optional per product) |
| Packs | Cart drawer + automatic discount when a full pack is in the cart | Packs |
| Social proof ("commandé par N clients") | Product card | Règles & paliers |
| One-click reorder, usual products | Banner under the header, order tracking modal | Règles & paliers |
| Add to order within N hours | Order confirmation and tracking modal | Règles & paliers |
| Loyalty tiers | Applied at order time from 90-day spend | Règles & paliers |
| Abandoned cart + reorder reminders | Telegram summary to staff at 08:00, list in admin | Relances |
| KPIs | Admin → Offres → Indicateurs, GA4 events add_to_cart / purchase | n/a |

## How prices are computed (`src/utils/offers.ts`, shared by browser and server)
1. Unit price = volume tier price (if reached) else list price, then the product's own `discountPercent`.
2. Pack discount for each complete pack in the cart.
3. Order discount = the higher of the reward-ladder percent and the loyalty percent (they do not stack).
4. Free delivery and gifts come from reward tiers.

The server recomputes every order with the same function (`priceOrderOnServer` in `storeDb.ts`), so prices sent by the browser are no longer trusted.

## New API routes
`GET/PUT /api/offers`, `POST /api/my-orders`, `POST /api/orders/:id/add-items`, `POST /api/carts`,
`GET /api/reminders/due`, `GET|POST /api/reminders/run` (cron; protected by `CRON_SECRET` when set).

## Data
`offers` and `carts` are new top-level keys of the store database (file store and the Supabase snapshot), so no SQL migration is needed.
Products gain optional `tierPrices` and `relatedProductIds`. Orders gain `subtotalDA`, `discountDA`, `appliedOffers`, `loyaltyTier`; order items gain `listPriceDA` and `priceDA` is now the effective unit price.

## Update: defaults, header, account menu, push

- **Volume defaults (Admin > Offres > Prix par volume)**: Extrait 500 g → −0.5 DA/g, 1000 g → −1 DA/g, Flacon 120 pcs → −5 DA/pc. They apply to the whole quantity, for every product of the family, unless a product defines its own tiers (which override the defaults). Editable in "Réductions par défaut par famille".
- **Packs header**: banner "Les Packs Tulip" above the catalogue, built from Offres > Packs (name, description, badge text, discount).
- **Reward ladder**: every configured tier (icon per type, locked/next/unlocked states, animated progress) pinned at the top of the cart and shown as a banner in the store above the packs. The lower cart drawer no longer repeats it.
- **Account menu**: click the user icon or name (loyalty badge beside it) for loyalty progress, "Suivre mes commandes", notifications and logout.
- **Push after order**: set `VAPID_PUBLIC_KEY`, `VAPID_PRIVATE_KEY`, `VAPID_SUBJECT` (see `.env.example`). The customer enables notifications from the account menu; right after an order is placed they get "ajoutez des articles jusqu'à HH:MM" (once, no timers on serverless). Needs HTTPS; iOS requires the site installed on the home screen. Toggle in Offres > Ajout après commande. Worker: `public/sw-push.js` (no caching).

## Customer push notifications (Offres > Relances)

| Category | Trigger | Counts toward cap |
|---|---|---|
| Order received (add-to-order) | order placed | no |
| Order status | admin sets confirmée / en préparation / livrée / annulée (PUT /api/orders/:id or PATCH /status) | no |
| Abandoned cart | saved cart older than N h, no order since (daily cron) | yes |
| Reorder reminder | no order for N days (daily cron, once per last order) | yes |
| Loyalty level-up | an order moves the customer to a higher tier | yes |

Rules (editable in admin): max per week (3), min hours between marketing pushes (48), send window 9h–19h Algiers. Each event is sent once (log in `pushLog`, kept 30 days). Customers can switch off "Offres et rappels" in their account menu; status messages always go out. Deep links: `/?track=1`, `/?cart=1`, `/?reorder=1`. The daily cron (`vercel.json`, 08:00 UTC = 09:00 Algiers) is what triggers cart and reorder pushes; a Hobby plan allows one run per day.

## Mobile layout (phones, under 640px)

Bottom navigation (Catalogue / Rapide / Panier with running total), header reduced to logo + account, search and filters no longer sticky, compact row-style product cards with 44px steppers, hero hidden for logged-in customers, compact ladder and packs banners. Desktop (640px+) is unchanged. Snapshot before this change: snapshots/snapshot-before-mobile-redesign.zip.

## Round 2 (after the mobile redesign)

- Product cards are back to the big-picture vertical card on phones (44px stepper/add buttons kept).
- The "Prix dégressifs" box is gone. Instead, when the quantity (cart + selected) reaches `adviceFromPercent` % of the next volume tier (default 25%: 125 g before 500 g, 30 pcs before 120), the card says "Ajoutez +N g, X DA/g au lieu de Y, économie Z" with a one-tap "Passer à 500 g" button. Setting: Offres > Prix par volume.
- Reward ladder is one slim multi-step bar (icon per step, filled progress), in the cart and the store banner.
- Catalogue / quick order switch: the tap is shown instantly (spinner on the nav button), repeated taps are ignored while switching, and the quick order list renders one layout and 30 rows at a time (more as you scroll). With 300 products and a 4x slower CPU the switch went from about 2.7-3.6 s to about 0.3-0.5 s, DOM nodes from 29,000 to 1,450.

## Quick order on phones (round 3)

No photos: one compact row per article (name, ref, price) with a live −/+ counter that edits the cart directly (100 g step for extraits, 1 for flacons; the number is also typeable). The "ajoutez +N g" hint with a "Passer à N" button shows under the row. Search and sticky family chips at the top. The desktop table is unchanged.

## Cart drawer cleanup (v8)
Photo-less item rows (name, code · unit price, 44px stepper, line total), no duplicate counts ("N éléments", "N réf."), no guarantee box or pill; full-height `100dvh` panel with safe-area padding; compact ladder on phones (icons + amounts, headline names the next reward); total and checkout pinned at the bottom.

Cart drawer v9: item cards restored to the old look (photo, card), still without duplicate counts/labels; quantity badge removed from the bottom cart buttons (phone nav and desktop bar).

v10: crossed-out list price in cart rows when promo/volume lowers it; adviceFromPercent default 60; reward ladder and loyalty on by default (unless saved as off); AccountMenu section 'Mes achats sur le site' (total spent, orders count, window spend) from insights.stats.
