# Magpollo

`Jan 2023–present · co-founder · 34 production applications`

Magpollo is the studio I co-founded. I lead technical and commercial delivery: finding and qualifying the work, discovery with the operator, solution architecture, scoping and proposals, and then staying accountable through the build and production support. It has shipped 34 production applications. Clients aren't named here; a few representative builds:

## AI systems for a real-estate operator

A nine-figure real-estate operator came with a vague operations problem. I took it to a signed AI systems engagement.

- **Mapped the real workflow first:** five people doing outreach by hand.
- **Kept AI where it belongs:** contact rules stay deterministic, while classification and drafting use AI. A human approves anything that goes out.
- **Fit their existing tools:** integrations designed around their Google Sheets, Gmail and Luma, instead of a new system to learn.

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
