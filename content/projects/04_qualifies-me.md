# Qualifies.me

`2025 · archived · AI product · Next.js · Supabase · solo, about 7 weeks`

You'd upload your resume, paste a job posting (or its link), and see how you stack up. Qualifies.me pulled out the job's key requirements, showed which ones your resume was missing, and suggested edits you could accept or reject one by one. It also wrote cover letters and exported both as PDFs.

It's not running anymore and the domain has expired, but I still think the engineering is worth showing.

<!-- TODO(haleem): users/sign-ups if you have them, and why it stopped. Screenshot/recording tracked in Linear. -->

## How I built it

The LLM parses the resume first, and there's always a backup. The model turns the resume into structured JSON, with a strict schema it has to follow. If the model fails, a parser I wrote by hand takes over. It's about 375 lines that handle different section names, bullet styles and date formats, and it has its own tests. If the model's output doesn't match the schema, the app fills in sensible defaults so the user still gets a result.

I told the model not to make things up. It can only suggest edits based on what's already in the resume. The missing requirements have to match the extracted requirements exactly, and suggested skills are capped. If a response comes back cut off, it's treated as an error.

Every AI action costs credits (parse is 1, tailor is 3, cover letter is 2), and the app checks your balance before calling the model. If you're out, the API returns a 429 with a clear message. A weekly GitHub Actions job calls a Supabase Edge Function that resets everyone's credits. It kept my LLM costs predictable without building a whole billing system.

The model is just a setting, so switching providers or models is a quick config change.

Serverless had a couple of surprises. The pdf.js worker had to be copied into the public folder at install time to work in production, and long cover letter generations kept hitting function timeouts until I cut them down.

## What I'd do differently

I'd keep the database schema in real migration files, since it only lived in the Supabase dashboard. And I'd track how often the backup parser kicked in, because that number would have told me how much to trust the LLM.

## Stack

Next.js 15 · React 19 · TypeScript · Supabase (Postgres, OAuth, Edge Functions) · OpenRouter · pdf.js · mammoth · pdf-lib · TanStack Query · zod · Jest · Vercel
