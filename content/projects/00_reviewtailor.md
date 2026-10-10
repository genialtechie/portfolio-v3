# ReviewTailor

`Oct 2025–present · founding engineer · AI product · Next.js · LLM pipelines`

ReviewTailor (the Career Companion product) helps people turn their real experience into career documents that hold up. I joined as founding engineer when it was a pre-user prototype. There was no shared repository and no way to ship it safely. I turned it into a production platform with a working engineering team around it.

[careercompanion.reviewtailor.com](https://careercompanion.reviewtailor.com)

## From prototype to a team that can ship

- **Infrastructure:** a GitHub organization with access controls, separate development, staging and production environments, CI/CD, and Vercel deployments.
- **Operations:** transactional email (Postmark), product analytics (PostHog), and release and observability practices the team still uses today.
- **Leadership:** I own technical and product direction: roadmap calls, architecture and releases. I run the weekly engineering cadence, unblock engineers and interns, and interview and onboard new contributors.

## Making the AI reliable

The core product generates nine kinds of career artifact from a person's history. I re-architected it around a single normalized career-context model, so every pipeline reads the same source of truth instead of its own copy.

- **Schema validation** on every model output, so malformed results are caught before users see them.
- **Evidence traceability:** generated claims link back to the user's real experience, so nothing gets invented.
- **Review and recovery paths:** when a generation goes wrong, the user can fix it instead of starting over.
- **Observability** across the pipelines, so failures show up as data, not as support tickets.

**Result:** failed generation flows dropped from about **20% to under 4%**, and more than 30 reliability, security and data-integrity issues were closed along the way.

## What it says about how I work

Reliability in AI products is mostly not about the model. It's about the data model underneath, validating everything that comes back, and giving users a way out when something fails.
