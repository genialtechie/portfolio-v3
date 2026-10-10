# IMAAN

`2026 · iOS (Expo / React Native) · Supabase · in App Store review`

A prayer app built around friends rather than willpower. You confirm each of the five daily prayers (optionally with a photo), keep a private history, and see your friends' streaks so you keep each other consistent. Missing a prayer never wipes your progress, and nothing in the app shames you.

<!-- TODO(haleem): confirm "solo" and add the App Store link once approved. -->

## The problem

Prayer trackers mostly work like habit trackers: a streak that resets to zero and makes you feel bad. I wanted accountability that feels like a group chat with good friends. That meant small circles, invite-only, no public leaderboard, and copy that encourages instead of scolds.

## What I built

- **Today:** five prayers, each confirmed with a tap or a photo from a live in-screen camera.
- **Footprints:** a private calendar of your history, laid out like a photo library.
- **Friends:** invite links only, day streaks next to names, nudges, and report/block.
- **Utilities:** a Qiblah compass (great-circle bearing plus the device compass), a tasbih counter, and shareable progress cards.
- **Reminders:** local notifications rescheduled whenever the day, the location or your confirmations change.

## Decisions worth explaining

**Streaks are computed in SQL, not on the phone.** The current run is a "gaps and islands" query: the unbroken chain back from your latest confirmed prayer. The client sends its local date, so the server never needs to reason about the user's timezone. That's a deliberate, documented v1 simplification. The edge cases are written up as test cases, checked against a local Postgres 16 before the migration shipped.

**Row-level security is enforced by the deploy, not by memory.** One migration fails if any public table is missing RLS. It caught a real gap on its first run: a legacy table that was still readable.

**Privacy-first friends.** Profiles are owner-only, so friends' names came through as raw IDs. Instead of loosening the table policy, I exposed exactly the fields friends need through a `SECURITY DEFINER` function. Photos live in a private bucket under per-user paths and are served through signed URLs that expire after an hour.

**Patching the native layer when the library was wrong.** The camera went blank after navigating away and back. The fix was in Expo's Swift camera session code, which I patched to rebuild the capture input and output on re-attach, and to report the error instead of showing an empty tile.

**App Store review is a feature.** The first submission came back under Guideline 2.1. For the resubmission I added self-serve account deletion, report and block as a single atomic action (with a trigger that prevents re-friending) and one permission request per onboarding screen, then ran a smoke test with two live accounts.

## Status

Submitted to App Store review in October 2026 after a three-day launch sprint tracked in Linear.

<!-- TODO(haleem): add review outcome, TestFlight tester count, any early numbers. -->

## Stack

Expo SDK 54 · React Native 0.81 (New Architecture) · expo-router · TypeScript · Reanimated · Supabase (Postgres, RLS, Storage, anonymous auth) · Aladhan prayer-times API · EAS Build & Submit
