// Boot log: the loading screen is a terminal that prints real load events with
// real numbers from the visitor's device. No fake progress, no typing effects:
// a line appears only when the thing it describes has happened.

export type BootLog = {
  /** Append a timestamped line. */
  line(text: string, tone?: "muted" | "good" | "warn"): void;
  /** Create (or update) the single live progress line for a download. */
  progress(label: string, loaded: number, total: number): void;
  /** Freeze the progress line into a normal timestamped line. */
  progressDone(text: string): void;
  /** Fade the boot screen out and remove it from the accessibility tree. */
  dismiss(durationMs: number): Promise<void>;
  /** Every finished line (timestamped), for mirroring onto the in-scene screen. */
  history(): { text: string; tone?: "muted" | "good" | "warn" }[];
  readonly active: boolean;
};

const BAR_WIDTH = 20;

const ts = () => `[${(performance.now() / 1000).toFixed(2)}s]`;

export const mb = (bytes: number) => (bytes / 1024 / 1024).toFixed(1);

export function createBootLog(onSkip: () => void): BootLog {
  const root = document.getElementById("boot");
  const logEl = document.getElementById("boot-log");
  const skipBtn = document.getElementById("boot-skip");
  let active = !!root;
  const entries: { text: string; tone?: "muted" | "good" | "warn" }[] = [];

  let progressEl: HTMLParagraphElement | null = null;
  let pending: { label: string; loaded: number; total: number } | null = null;
  let rafId = 0;

  const append = (text: string, tone?: string) => {
    if (!logEl) return null;
    const p = document.createElement("p");
    p.className = "boot-line" + (tone ? ` is-${tone}` : "");
    const t = document.createElement("span");
    t.className = "boot-ts";
    t.textContent = ts();
    p.append(t, document.createTextNode(" " + text));
    logEl.appendChild(p);
    return p;
  };

  const flushProgress = () => {
    rafId = 0;
    if (!pending || !logEl) return;
    const { label, loaded, total } = pending;
    const frac = total > 0 ? Math.min(1, loaded / total) : 0;
    const filled = Math.round(frac * BAR_WIDTH);
    const bar = "█".repeat(filled) + "░".repeat(BAR_WIDTH - filled);
    if (!progressEl) {
      progressEl = append("") as HTMLParagraphElement;
      progressEl.classList.add("is-live");
      // Progress ticks would flood screen readers; the final line is announced instead.
      progressEl.setAttribute("aria-hidden", "true");
    }
    const tsEl = progressEl.firstChild as HTMLElement;
    tsEl.textContent = ts();
    progressEl.lastChild!.textContent = ` ${label}  ${bar}  ${mb(loaded)} / ${mb(total)} MB`;
  };

  const onKey = (e: KeyboardEvent) => {
    if (e.key === "Enter" && active && document.activeElement === document.body) onSkip();
  };
  window.addEventListener("keydown", onKey);
  skipBtn?.addEventListener("click", () => onSkip());

  return {
    get active() {
      return active;
    },
    line(text, tone) {
      const p = append(text, tone);
      entries.push({ text: (p?.firstChild?.textContent ?? ts()) + " " + text, tone });
    },
    history() {
      return entries.slice();
    },
    progress(label, loaded, total) {
      pending = { label, loaded, total };
      if (!rafId) rafId = requestAnimationFrame(flushProgress);
    },
    progressDone(text) {
      if (rafId) cancelAnimationFrame(rafId);
      rafId = 0;
      pending = null;
      if (progressEl) {
        progressEl.remove();
        progressEl = null;
      }
      const p = append(text);
      entries.push({ text: (p?.firstChild?.textContent ?? ts()) + " " + text });
    },
    dismiss(durationMs) {
      if (!root || !active) return Promise.resolve();
      active = false;
      window.removeEventListener("keydown", onKey);
      root.style.setProperty("--boot-fade", `${durationMs}ms`);
      root.classList.add("is-leaving");
      return new Promise((resolve) => {
        window.setTimeout(() => {
          root.hidden = true;
          resolve();
        }, durationMs);
      });
    },
  };
}

/** Short, readable GPU name from the WebGL debug extension (falls back gracefully). */
export function describeGpu(gl: WebGLRenderingContext | WebGL2RenderingContext) {
  const ext = gl.getExtension("WEBGL_debug_renderer_info");
  let name = ext ? String(gl.getParameter(ext.UNMASKED_RENDERER_WEBGL)) : "";
  if (!name) name = String(gl.getParameter(gl.RENDERER) || "unknown gpu");
  // "ANGLE (Apple, ANGLE Metal Renderer: Apple M2, Unspecified Version)" -> "Apple M2"
  const angle = name.match(/ANGLE \(([^,]+),\s*([^,]+?)(?:\s*\(0x[0-9a-f]+\))?(?:,|\))/i);
  if (angle) name = angle[2]!.replace(/^ANGLE Metal Renderer:\s*/i, "").replace(/Direct3D.*$/i, "").trim();
  return name.length > 40 ? name.slice(0, 39) + "…" : name;
}
