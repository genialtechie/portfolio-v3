import { track as vercelTrack } from "@vercel/analytics";

// Product events (anonymous counts in Vercel Analytics). One place so event
// names stay consistent and nothing here can break the experience.
export type EventName =
  | "boot_ready"
  | "boot_error"
  | "skip_text_mode"
  | "open_portfolio"
  | "open_page"
  | "play_hoopzy"
  | "hint_shown"
  | "hint_followed";

export function track(name: EventName, props?: Record<string, string | number | boolean>) {
  try {
    vercelTrack(name, props);
    if (import.meta.env.DEV) console.debug("[track]", name, props ?? {});
  } catch {
    // Analytics must never affect the site.
  }
}
