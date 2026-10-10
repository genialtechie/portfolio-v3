# Magpollo

`Jan 2023 to now · co-founder · 34 production apps`

Magpollo is the software studio I co-founded. I lead both the technical and commercial side, so I'm involved from the start: finding the work, sitting down with the business owner to understand the problem, designing the solution, writing the proposal, and then staying on through the build and production support. We've shipped 34 production apps so far.

I don't name our clients here, but here are a few examples of the work.

## AI systems for a real estate operator

A nine-figure real estate company came to us with a messy operations problem, and I took it from there to a signed AI systems engagement.

- I started by mapping how the work actually got done: five people doing outreach by hand.
- I kept the rules for who gets contacted, and when, as plain code, and only used AI for sorting and drafting messages. A person approves everything before it goes out.
- I designed it around the tools they already use (Google Sheets, Gmail and Luma), so the team doesn't have to learn a new system.

## A youth culture media platform

A publication with articles, videos, events and a daily music game, all running on a headless CMS.

- When an editor publishes in Strapi, a signed webhook tells the site to refresh only the pages that changed, with no full rebuild.
- I wrote a script to move all their old WordPress posts and images into the new CMS (153 posts). If it failed partway through, it could pick up where it left off.
- The music game picks a daily song from Spotify based on the date, so everyone gets the same puzzle that day. Your progress saves on your device, and there's a pass the phone mode.

Next.js · Strapi · PostgreSQL · Cloudinary

## Events, tickets and awards for an entertainment company

We've worked with this company for about two years on event teasers, a ticketing backend, and awards voting.

- Voting is built to be hard to cheat: one vote per device per category, Cloudflare Turnstile to block bots, and rate limits with Upstash.
- Their team can run everything from the CMS, including events, series, media, award years and nominees.

Next.js · Strapi · Sanity · Supabase · Upstash · Turnstile

## Custom commerce

The 3D configurator and store has its own write-up: **[Custom commerce](#page=projects/custom-commerce)**.

## How we work

We scope things with a fixed blueprint before we build, keep teams small, and only turn something into a reusable product once a few clients actually need it. Our internal tools follow the same rule.
