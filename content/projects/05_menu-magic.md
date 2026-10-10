# Menu Magic

`2025 to 2026 · archived · learning project · self-hosted AI image pipeline`

A lot of restaurants on delivery apps have bad food photos or none at all. Menu Magic took a DoorDash, Uber Eats, Grubhub or Shopify link, grabbed the menu and its photos, and generated better looking product shots in all the sizes each platform needs. You could scrape and set everything up for free, and you only had to sign in when you hit generate.

It was mostly how I learned what goes on underneath AI products. I wanted to understand how these models are put together, run and hosted, beyond just calling an API. So I ran the image model myself, with my own workflow, my own custom node and my own server. I got the whole pipeline working end to end, and then the server costs ended it.

## How it was built

It had three parts:

- **The web app** (Next.js): the guided flow, the dashboard, downloads, and Stripe image packs
- **A scraper service** (Fastify): figures out which platform the link is from, tries a quick HTML parse first, and falls back to a headless browser for sites with bot protection. Images go to Cloudinary and jobs go to Supabase.
- **A generation service** (Fastify and ComfyUI on a VM): queues one generation per output size, checks for results, and saves them

## The interesting parts

I wrote a custom ComfyUI node that captions each food photo (with BLIP) and builds the prompt right inside the workflow. The prompt combines the caption, a style and a composition hint, and tells the model to keep the product looking like itself. The negative prompt rules out text, watermarks and hands. The original photo also guides the composition, so the generated burger still looks like their burger.

I made sure nobody could get charged twice. The Stripe webhook checks if a payment was already processed before adding credits. Taking credits away locks the balance row in Postgres, and generation requests can carry an idempotency key, so a retry never double charges.

The services were locked down with service to service auth, a CORS allowlist, rate limits, retries with backoff, and alerts when jobs failed or ran slow.

## Why it stopped

On a CPU, I had to drop to 4 generation steps and roughly 512px images just to get reasonable speeds. Good quality needed a GPU, and a GPU server didn't make financial sense at what an image pack could sell for. I learned more about the real cost of hosting your own model from that one bill than from anything I read.

I also split the build across a few AI coding agents, each with its own git worktree and its own files (scraper, generation, UI), and I put the pieces together. It worked well for building things in parallel, and showed me how clear the boundaries need to be.

<!-- TODO(haleem): sanity-check the agents paragraph against how you actually ran it. -->

## Stack

Next.js 14 · TypeScript · Supabase (Postgres, RLS) · Stripe · Fastify · cheerio · Browserless · Cloudinary · ComfyUI · Flux.2 Klein · BLIP · PostHog · Azure VM
