# Magpollo

`2023–present · co-founder, engineering · client work for small and owner-led businesses`

Magpollo is the studio I co-founded. I lead the engineering: scoping, building and running production systems for businesses that don't have their own engineering team. A few representative builds:

<!-- TODO(haleem): confirm which clients can be named publicly. Until then these are described, not named. Also confirm the project count; I found ~10 engagements in your code folder, so "30+" needs backing or softening. Confirm "I lead the engineering" (every client repo commit is yours) and Charles's role. -->

## A youth-culture media platform

A publication with articles, video, events and a daily music game, running on a headless CMS.

- **Content that updates without a rebuild.** Publishing in Strapi triggers a signed webhook, and only the affected pages revalidate.
- **Moving off WordPress without losing anything.** A migration script carried posts and images over into the new CMS (153 posts), and could resume after a failure instead of starting over.
- **A daily music game.** A Spotify-backed daily song chosen deterministically from the date, so every reader gets the same puzzle, with game state saved locally and a pass-the-phone mode.

Next.js · Strapi · PostgreSQL · Cloudinary

## Events, tickets and awards for an entertainment company

About two years of work for one company: event teasers, a ticketing backend, and awards voting.

- **Voting that's hard to game:** one vote per device per category, bot checks with Cloudflare Turnstile, and rate limits with Upstash.
- **Content editors can run it themselves:** events, series, media, award years and nominees are all modeled in the CMS.

Next.js · Strapi · Sanity · Supabase · Upstash · Turnstile

## Custom commerce

The 3D configurator and store, covered in its own case study: **[Custom commerce](#page=projects/custom-commerce)**.

## How I run client work

Fixed-scope blueprints before builds, small teams, and productizing a pattern only once several clients need it. The internal tools follow the same rule: lead capture, analytics and proof-of-work pages, built when needed and not before.
