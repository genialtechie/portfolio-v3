import { track } from "./analytics";

// Status-bar hints: a short tmux-style message in the HUD, shown once per
// visitor, at the moment it's useful. Never more than one at a time; it fades
// on its own or as soon as the visitor does what it suggests.

const STORAGE_PREFIX = "hint.v1.";
const DEFAULT_TTL_MS = 6000;

export type Hints = {
  /** Show a hint unless it was seen before or another hint is up. Returns true if shown. */
  show(id: string, text: string, ttlMs?: number): boolean;
  /** The visitor did what hint `id` suggested (whether or not it's visible now). */
  followed(id: string): void;
  seen(id: string): boolean;
  /** Hide whatever is showing (e.g. the overlay opened). */
  clear(): void;
};

function readSeen(id: string) {
  try {
    return localStorage.getItem(STORAGE_PREFIX + id) === "1";
  } catch {
    return false;
  }
}

function markSeen(id: string) {
  try {
    localStorage.setItem(STORAGE_PREFIX + id, "1");
  } catch {
    // Private mode etc.: hints may repeat next visit, which is fine.
  }
}

export function createHints(el: HTMLElement): Hints {
  let current: string | null = null;
  let timer = 0;
  const shown = new Set<string>();

  const hide = () => {
    window.clearTimeout(timer);
    el.classList.remove("is-visible");
    current = null;
  };

  return {
    show(id, text, ttlMs = DEFAULT_TTL_MS) {
      if (current || readSeen(id)) return false;
      current = id;
      shown.add(id);
      markSeen(id);
      el.textContent = text;
      el.classList.add("is-visible");
      timer = window.setTimeout(hide, ttlMs);
      track("hint_shown", { id });
      return true;
    },
    followed(id) {
      // Only count follows for hints this visitor actually saw this session.
      if (shown.has(id)) {
        shown.delete(id);
        track("hint_followed", { id });
      }
      if (current === id) hide();
    },
    seen: readSeen,
    clear: hide,
  };
}
