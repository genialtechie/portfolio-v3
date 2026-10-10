# Imaan

`2026 · iOS (Expo / React Native) · Supabase · solo · in App Store review`

Imaan is a prayer app built around friends. You confirm each of the five daily prayers (with a photo if you want), keep a private history, and see your friends' streaks so you all keep each other consistent. If you miss a prayer you don't lose your progress, and the app never tries to make you feel bad about it.

## Why I built it

Most prayer trackers work like habit trackers. You build a streak, miss one day, and it resets to zero. I wanted something that feels more like a group chat with good friends. So it's small circles, invite only, no public leaderboard, and all the copy is encouraging.

## What's in it

- **Today:** the five prayers, each confirmed with a tap or a photo from a camera built right into the screen
- **Footprints:** a private calendar of your history that looks like a photo library
- **Friends:** invite links only, streaks next to everyone's name, nudges, and report and block
- **Extras:** a Qiblah compass, a tasbih counter, and progress cards you can share
- **Reminders:** local notifications that reschedule themselves whenever the day, your location or your confirmations change

## How it works under the hood

Streaks are calculated in SQL on the server. The current streak is a "gaps and islands" query, which basically finds the unbroken chain going back from your latest confirmed prayer. The phone sends its local date, so the server never has to figure out the user's timezone. I wrote that down as a known simplification for v1. I also wrote out the edge cases as test cases and checked them against a local Postgres 16 before shipping the migration.

I made the database itself enforce security. One migration fails if any public table is missing row-level security. The first time it ran, it actually caught a gap on an old table that was still readable.

Friends needed to see each other's names, but profiles are private by default, so at first names showed up as raw IDs. I didn't want to open up the whole table, so I added a small database function that only returns the fields a friend needs. Photos live in a private bucket under each user's folder, and the app shows them through links that expire after an hour.

I also had to patch the native code. The camera went blank if you navigated away and came back. The bug was in Expo's Swift camera code, so I patched it to rebuild the camera session when the view comes back, and to show an error instead of an empty box.

## Getting through App Store review

Since this was my first app on a new developer account, the first submission got rejected under Guideline 2.1 (app completeness), and I had to take out the demo content. For the resubmission I added account deletion, report and block (done as one action, with a rule that stops a blocked person from re-adding you), and one permission request per onboarding screen. Then I ran a full test with two real accounts before submitting again.

It's back in review now, after a three day launch sprint I tracked in Linear.

<!-- TODO(haleem): add the review outcome and App Store link once approved. -->

## Stack

Expo SDK 54 · React Native 0.81 (New Architecture) · expo-router · TypeScript · Reanimated · Supabase (Postgres, RLS, Storage, anonymous auth) · Aladhan prayer times API · EAS Build and Submit
