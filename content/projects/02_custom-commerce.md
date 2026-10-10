# Custom commerce

`2025 to 2026 · web · three.js / React Three Fiber · Next.js · Stripe · a Magpollo product`

[Watch the demo](https://commerce.magpollo.com/watch) · [Try the configurator](https://commerce.magpollo.com/configurator)

This is a 3D configurator and store for custom grillz. The customer picks individual teeth on a 3D model, chooses the metal, finish, stones and cut, and watches the price update as they go. When they check out, the jeweler gets an order they can build straight from, without any back and forth.

We built it for one client first, and now Magpollo sells it as a service to multiple clients.

## The problem

Custom jewelry like this is usually sold through DMs and screenshots. The customer describes what they want, the jeweler works out a quote by hand, and details get lost somewhere between "gold on the top six" and what actually gets made. We wanted to replace all of that with one page: guided choices, a live price, and an order the workshop can use as is.

## Results

- Over 5,000 automated quotes, each one a price the jeweler didn't have to work out by hand
- Five figures in revenue for Magpollo so far
- Leads went up more than 30%, and a lot more of them were high-ticket, high-intent buyers. A checkout this visual is something the client can actually promote on Instagram.
- A lot fewer "how much will this cost?" messages. That one is from what the client tells us, we didn't measure it.

## What I built

- **A per-tooth 3D configurator.** Each tooth in the model has its own name, and the code maps those names to numbers 0 to 31. That way every tooth keeps its own metal, finish and stone settings.
- **Pricing the jeweler controls.** Per-tooth prices, flat prices for common sets (6×6 up to 14×14), and a metal and stone price table all live in the CMS (Sanity), so they can change prices without me.
- **Checkout and orders.** Stripe Checkout (card, Affirm and Klarna), Postgres with Prisma, and a signed webhook that marks orders as paid.
- **Support chat.** Customer messages go to the shop's Telegram. Each customer gets their own topic, and replies come back to the site.
- **A public demo** on Magpollo's site, with each step of the funnel tracked in PostHog.

## A few decisions I'm happy with

I save the order before the customer pays. The full configuration goes into the database as a pending order first, and then I create the Stripe session. I ended up here because Stripe limits how much data you can attach to a payment. So the full details live in Postgres, and Stripe just gets a short build summary like "Cut: PERM CUT | Teeth 5,6,7: Gold 10k Yellow Iced Out w/ VS1". If the webhook ever gets a payment with no matching order, it stops there.

Orders keep a copy of the product details from the moment of purchase. If the jeweler edits a product later, old orders stay exactly how they were.

The options can't conflict. If you change the metal, your color, style and stone choices reset. If you change the color, style and stone reset. You only see stones that have a price for the metal you picked. So a combination the workshop can't make never gets ordered.

I also put work into making the 3D run well on phones. I got the tooth model down from 2.08 MB to 510 KB. All the stones render as one instanced mesh, materials get reused, everything gets cleaned up when you leave, and pixel density is capped. The configurator page only loads when you open it, so the marketing page stays fast.

If I picked it back up, I'd cache the stone layout so it doesn't rebuild on every change, and I'd add tests around pricing, since that's the part where a bug costs real money.

## Stack

React Three Fiber · three.js · drei · Next.js 15 · React 19 · Zustand · Sanity · Prisma + PostgreSQL · Stripe · Clerk · PostHog · Vercel

<!-- TODO(haleem): did you do the 3D model optimisation yourself (Blender)? Solo or with a designer? Why was AR added and then removed? -->
