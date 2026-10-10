# Qualifies.me

`2025 · archived · AI product · Next.js · Supabase · solo, about 7 weeks`

Upload your resume, paste a job posting (or its URL), and see exactly how you stack up. Qualifies.me pulled out the role's key requirements, showed which ones your resume was missing, and suggested edits you could accept or reject one diff at a time. It also wrote cover letters and exported both documents as PDFs.

It's no longer running; the domain has lapsed. The engineering is still worth showing.

<!-- TODO(haleem): users/sign-ups if you have them; why it stopped; a screenshot or short screen recording would help a lot since there's no live link. -->

## Decisions worth explaining

**Use the LLM first, but always have a fallback.** Resumes were parsed into structured JSON by an LLM, with a strict JSON schema enforced on the response. If the model failed, a hand-written parser took over: about 375 lines covering section-header synonyms, bullet styles and date ranges, with its own tests. If schema validation failed, the app filled in sensible defaults instead of erroring. Users got a usable result instead of a spinner and an apology.

**"Don't make things up" is a requirement.** The tailoring prompt only allows suggestions grounded in the resume. Missing requirements must exactly match the extracted key requirements, and suggested skills are capped. If a reply came back cut off, it was treated as an error.

**Metered usage instead of a paywall.** Every AI action cost credits (parse 1, tailor 3, cover letter 2), checked before the call. When credits ran out, the API returned a 429 instead of failing at random. A weekly GitHub Actions cron called a Supabase Edge Function to reset everyone's allowance. That kept LLM spend predictable without building billing.

**Swappable models.** The model is configuration, not code, so changing providers or tiers is a deploy, not a refactor.

**Serverless sharp edges.** The pdf.js worker had to be copied into the public folder at install time to work in production. Long cover-letter generations hit function timeouts and had to be cut down. Neither shows up in tutorials.

## What I'd do differently

Store the database schema as real migrations (it lived only in the dashboard), and track how often the fallback parser kicked in, because that number would have told me how much to trust the LLM path.

## Stack

Next.js 15 · React 19 · TypeScript · Supabase (Postgres, OAuth, Edge Functions) · OpenRouter · pdf.js · mammoth · pdf-lib · TanStack Query · zod · Jest · Vercel
