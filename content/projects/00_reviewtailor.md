# ReviewTailor

`Oct 2025 to now · founding engineer · AI product · Next.js · LLM pipelines`

[careercompanion.reviewtailor.com](https://careercompanion.reviewtailor.com)

ReviewTailor (the Career Companion product) helps people turn their real experience into career documents they can stand behind. I joined as the founding engineer when it was still a prototype with no users. There was no shared repo and no real way to ship it, so a big part of my job was building the product and the team around it at the same time.

## Getting it ready to ship

The first thing I did was set up the basics so we could work like a real engineering team. That meant a GitHub organization with proper access, separate development, staging and production environments, CI/CD, and Vercel deployments. I also added Postmark for email and PostHog for analytics, plus the release and observability habits the team still uses today.

I own the technical and product direction now. I make the roadmap and architecture calls, run our weekly engineering cadence, help unblock the engineers and interns, and interview and onboard new people.

## Making the AI reliable

The product generates nine different kinds of career documents from a person's history. When I got there, the pipelines were each doing their own thing, so I re-architected everything around one normalized career-context model that every pipeline reads from.

From there I added:

- schema validation on everything the model returns, so bad output gets caught before a user ever sees it
- evidence tracing, so every generated claim links back to something the person actually did
- review and recovery paths, so when a generation goes wrong the user can fix it without starting over
- observability across the pipelines, so we see failures in the data before they turn into support tickets

Failed generations dropped from about 20% to under 4%. Along the way we closed more than 30 reliability, security and data-integrity issues.

The biggest lesson for me is that the model is only one part of it. Most of the reliability came from the data model underneath, checking what comes back, and giving users a way out when something breaks.
