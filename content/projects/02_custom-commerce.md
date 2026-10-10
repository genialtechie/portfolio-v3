# Custom commerce

`2025–26 · web · three.js / React Three Fiber · Next.js · Stripe · client work through Magpollo`

A 3D configurator and store for custom grillz (dental jewelry). The customer picks individual teeth on a 3D model, then chooses metal, finish, plain or iced-out stones, and cut, and watches the price update as they go. When they check out, the jeweler receives an order they can build from without a single back-and-forth message.

[Watch the demo](https://commerce.magpollo.com/watch) · [Try the configurator](https://commerce.magpollo.com/configurator)

<!-- TODO(haleem): confirm the "sold over DMs" framing matches the client. Can the client brand be named? Add live store URL, order volume or revenue if shareable. -->

## The problem

Made-to-order jewelry is sold over Instagram DMs. Customers describe what they want, the jeweler quotes by hand, and details get lost between "gold on the top six" and what actually gets made. The goal was to replace that conversation with a page: guided choices, a live price, and an order spec the workshop can use directly.

## What I built

- **A per-tooth 3D configurator.** The mouth model's meshes are named by tooth, and those names become indices 0–31, so every tooth carries its own metal, finish and stone settings.
- **Pricing the jeweler controls.** Per-tooth prices, flat prices for standard sets (6×6 up to 14×14), and a metal × stone table all live in the CMS (Sanity) and are loaded on the server.
- **Checkout and orders.** Stripe Checkout (card, Affirm, Klarna), Postgres via Prisma, and a signed webhook that marks orders paid.
- **Support built in.** Customer chat lands in the shop's Telegram: each customer gets their own forum topic, and replies flow back to the site.
- **A public demo** on Magpollo's site, with a funnel tracked step by step in PostHog.

## Decisions worth explaining

**The order exists before the payment does.** The full configuration is saved as a pending order *first*, then the Stripe session is created. Stripe's metadata limit made this the right call: the complete JSON lives in Postgres, and Stripe gets a short, readable build spec ("Cut: PERM CUT | Teeth 5,6,7: Gold 10k Yellow Iced Out w/ VS1"). The webhook refuses to invent an order it can't find.

**Orders don't change when products do.** Order items copy product data at purchase time, so editing a product in the CMS never rewrites history.

**Choices that can't conflict.** Changing the metal family clears color, style and stone; changing color clears style and stone. Only stones that have a price for the chosen metal are offered. Impossible combinations can't be selected, so they never reach the workshop.

**Making 3D cheap enough for phones.** The tooth model went from 2.08 MB to 510 KB. Stones are a single instanced mesh rather than thousands of objects. Materials are cached and reused, everything is disposed on unmount, and pixel density is capped. The configurator route is lazy-loaded, so the marketing page stays fast.

**What I'd do next:** cache the stone layout instead of regenerating it on every change, and add tests around the pricing rules, the part where a bug costs real money.

## Stack

React Three Fiber · three.js · drei · Next.js 15 · React 19 · Zustand · Sanity · Prisma + PostgreSQL · Stripe · Clerk · PostHog · Vercel

<!-- TODO(haleem): did you do the 3D model optimisation yourself (Blender)? Solo or with a designer? Why was AR added and then removed? -->
