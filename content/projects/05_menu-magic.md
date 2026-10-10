# Menu Magic

`2025–26 · archived prototype · AI image pipeline · Next.js · Fastify · ComfyUI`

Restaurants on delivery apps often have bad or missing food photos. Menu Magic took a DoorDash, Uber Eats, Grubhub or Shopify link, scraped the menu and its photos, and generated restyled, on-brand product shots in the sizes each platform needs. Scraping and setup were free; signing in was only required at the generate step.

It reached a working end-to-end pipeline but never a public launch.

<!-- TODO(haleem): confirm the reason it stopped (my read: GPU cost vs pricing). Any users or payments? -->

## How it was built

Three pieces, each with one job:

- **The web app** (Next.js): the guided flow, dashboard, downloads and Stripe image packs.
- **A scraper service** (Fastify): detects the platform, tries a fast HTML parse first, and falls back to a stealth headless browser for sites behind bot protection. Images go to Cloudinary; jobs go to Supabase.
- **A generation service** (Fastify + ComfyUI on a VM): queues one generation per output size, polls for results and stores them.

## Decisions worth explaining

**Captioning inside the model graph.** I wrote a custom ComfyUI node that captions each product photo (BLIP) and builds the prompt inside the workflow: caption + style + composition, with "preserve product identity" in the prompt and text, watermarks and hands in the negative. The model loads once behind a lock. The original photo also drives the composition, so the generated burger is still *their* burger.

**Money-safe from the start.** The Stripe webhook is idempotent (it checks the payment ID before crediting). Credit deduction locks the balance row in Postgres, and generation requests accept an idempotency key. A retry can never charge twice.

**Hardened services.** Service-to-service auth, a CORS allowlist, rate limits, retries with backoff, and a throttled alert webhook for failures and slow jobs.

**The honest constraint.** On CPU, generation needed 4 steps and roughly 512px images to be bearable. Production quality needed a GPU, and the economics of a GPU box didn't fit the price of an image pack yet. That's where it paused.

**Working with AI agents.** I split the build across named coding agents, each with its own git worktree and file ownership (scraper, generation, UI), and acted as the integrator. It worked well for parallel work and taught me where agents need tight boundaries.

<!-- TODO(haleem): sanity-check the agents paragraph against how you actually ran it. -->

## Stack

Next.js 14 · TypeScript · Supabase (Postgres, RLS) · Stripe · Fastify · cheerio · Browserless · Cloudinary · ComfyUI · Flux.2 Klein · BLIP · PostHog · Azure VM
