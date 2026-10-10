// Hoopzy, playable inside the arcade cabinet. hoopzy.fun runs in an iframe
// framed like an upright cabinet on larger screens, and full screen on phones.
// The iframe only exists while the cabinet is open, so the game costs nothing
// until someone plays it and stops running the moment they leave.

type MountOptions = {
  url: string;
  onClose: () => void;
};

const LOAD_SLOW_MS = 10_000;

export function mountArcade(root: HTMLElement, opts: MountOptions) {
  const prevActive = document.activeElement as HTMLElement | null;
  const gameOrigin = new URL(opts.url).origin;

  const el = document.createElement("div");
  el.className = "arcade";
  el.setAttribute("role", "dialog");
  el.setAttribute("aria-modal", "true");
  el.setAttribute("aria-label", "Hoopzy");
  el.innerHTML = `
    <div class="arcade-scrim" aria-hidden="true"></div>
    <div class="arcade-cab">
      <div class="arcade-marquee" aria-hidden="true"><span>HOOPZY</span></div>
      <div class="arcade-bezel">
        <div class="arcade-screen">
          <p class="arcade-loading" role="status">
            <span class="arcade-loading-line">loading ${new URL(opts.url).host}<span class="arcade-cursor">_</span></span>
            <a class="arcade-slow" href="${opts.url}" target="_blank" rel="noopener" hidden>taking a while · open in a new tab ↗</a>
          </p>
        </div>
      </div>
      <div class="arcade-deck">
        <span class="arcade-controls" aria-hidden="true">
          <span class="arcade-stick"></span>
          <span class="arcade-btn is-red"></span>
          <span class="arcade-btn is-blue"></span>
        </span>
        <a class="arcade-ext" href="${opts.url}" target="_blank" rel="noopener">hoopzy.fun ↗</a>
        <button type="button" class="arcade-exit"><kbd>esc</kbd> exit</button>
      </div>
    </div>
  `;

  const screen = el.querySelector<HTMLDivElement>(".arcade-screen")!;
  const loading = el.querySelector<HTMLParagraphElement>(".arcade-loading")!;
  const slow = el.querySelector<HTMLAnchorElement>(".arcade-slow")!;
  const exitBtn = el.querySelector<HTMLButtonElement>(".arcade-exit")!;

  const iframe = document.createElement("iframe");
  iframe.title = "Hoopzy";
  iframe.src = opts.url;
  iframe.allow = "autoplay; fullscreen; gamepad";
  iframe.referrerPolicy = "strict-origin";
  screen.appendChild(iframe);

  const slowTimer = window.setTimeout(() => {
    slow.hidden = false;
  }, LOAD_SLOW_MS);

  iframe.addEventListener("load", () => {
    window.clearTimeout(slowTimer);
    el.classList.add("is-loaded");
    loading.hidden = true;
    // Hand the keyboard to the game.
    iframe.focus();
  });

  exitBtn.addEventListener("click", () => opts.onClose());
  el.querySelector(".arcade-scrim")!.addEventListener("click", () => opts.onClose());

  // Keys go to the iframe once it has focus, so hoopzy.fun reports Esc itself.
  const onMessage = (e: MessageEvent) => {
    if (e.origin !== gameOrigin || e.source !== iframe.contentWindow) return;
    const data = e.data as { type?: string; value?: unknown } | null;
    if (data?.type === "hoopzy:exit") opts.onClose();
    if (data?.type === "hoopzy:best" && typeof data.value === "number") {
      try {
        localStorage.setItem("hoopzy.best", String(data.value));
      } catch {
        // Storage can be unavailable (private mode); the score is a nice-to-have.
      }
    }
  };
  window.addEventListener("message", onMessage);

  // Keep Tab inside the cabinet: the game, the link and the exit button.
  const onKeydown = (e: KeyboardEvent) => {
    if (e.key !== "Tab") return;
    const stops = [iframe, el.querySelector<HTMLElement>(".arcade-ext")!, exitBtn];
    const i = stops.indexOf(document.activeElement as HTMLElement);
    const next = stops[(i + (e.shiftKey ? -1 : 1) + stops.length) % stops.length]!;
    e.preventDefault();
    next.focus();
  };
  el.addEventListener("keydown", onKeydown);

  root.appendChild(el);
  // Next frame, so the entrance transition runs.
  requestAnimationFrame(() => el.classList.add("is-open"));
  exitBtn.focus({ preventScroll: true });

  return () => {
    window.clearTimeout(slowTimer);
    window.removeEventListener("message", onMessage);
    // Removing the iframe stops the game loop and its audio right away.
    iframe.src = "about:blank";
    el.remove();
    prevActive?.focus?.();
  };
}
