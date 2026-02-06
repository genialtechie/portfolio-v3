import { marked } from "marked";

type MountOptions = {
  onClose: () => void;
};

type Theme = "dark" | "light";

type Page = {
  id: string;
  title: string;
  kind: "home" | "md";
  load?: () => Promise<string>;
  srcPath?: string;
};

const pageModules = import.meta.glob("/content/**/*.md", {
  query: "?raw",
  import: "default",
});

function getHashParam(key: string) {
  const raw = location.hash.startsWith("#") ? location.hash.slice(1) : location.hash;
  return new URLSearchParams(raw).get(key);
}

function setHashParam(key: string, value: string | null, mode: "push" | "replace" = "replace") {
  const raw = location.hash.startsWith("#") ? location.hash.slice(1) : location.hash;
  const params = new URLSearchParams(raw);
  if (value == null) params.delete(key);
  else params.set(key, value);
  const next = params.toString();

  if (mode === "replace") history.replaceState(null, "", next ? `#${next}` : "#");
  else location.hash = next;
}

function toIdFromPath(p: string) {
  const rel = p.replace(/^\/content\//, "").replace(/\.md$/i, "");
  const parts = rel.split("/").filter(Boolean);

  const slug = (s: string) =>
    s
      .trim()
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-+|-+$/g, "");

  return parts
    .map((part, idx) => {
      const isFile = idx === parts.length - 1;
      const cleaned = isFile ? part.replace(/^\d+[-_\s]*/, "") : part;
      return slug(cleaned);
    })
    .filter(Boolean)
    .join("/");
}

function toTitleFromPath(p: string) {
  const base = p.split("/").pop() || p;
  const name = base.replace(/\\.md$/i, "");
  const cleaned = name.replace(/^\\d+[-_\\s]*/, "").replace(/[_-]+/g, " ").trim();
  return cleaned ? cleaned : "Untitled";
}

function buildPages(): Page[] {
  const entries = Object.entries(pageModules) as Array<[string, () => Promise<string>]>;
  entries.sort(([a], [b]) => a.localeCompare(b));
  return entries.map(([p, load]) => ({
    id: toIdFromPath(p),
    title: toTitleFromPath(p),
    kind: "md",
    load,
    srcPath: p,
  }));
}

function qs<T extends Element>(root: ParentNode, sel: string): T {
  const el = root.querySelector(sel);
  if (!el) throw new Error(`Missing overlay element: ${sel}`);
  return el as T;
}

function buttonDot(cls: string, ariaLabel: string, onClick: () => void) {
  const btn = document.createElement("button");
  btn.type = "button";
  btn.className = cls;
  btn.setAttribute("aria-label", ariaLabel);
  btn.addEventListener("click", onClick);
  return btn;
}

function createTuiLine(text: string, tone: "muted" | "good" | "warn" | "plain" = "plain") {
  const line = document.createElement("div");
  line.className = `tui-line ${tone !== "plain" ? `is-${tone}` : ""}`.trim();
  line.textContent = text;
  return line;
}

function getInitialTheme(): Theme {
  const stored = (localStorage.getItem("overlayTheme") || "").toLowerCase();
  if (stored === "dark" || stored === "light") return stored;
  return window.matchMedia?.("(prefers-color-scheme: dark)")?.matches ? "dark" : "light";
}

export function mountMacOverlay(root: HTMLElement, opts: MountOptions) {
  root.innerHTML = "";

  const pages = buildPages();
  const allPages: Page[] = [{ id: "home", title: "Home", kind: "home" }, ...pages];

  const overlay = document.createElement("div");
  overlay.className = "macos-overlay";
  overlay.setAttribute("role", "dialog");
  overlay.setAttribute("aria-modal", "true");

  const win = document.createElement("div");
  win.className = "macos-window";

  const titlebar = document.createElement("div");
  titlebar.className = "macos-titlebar";

  const traffic = document.createElement("div");
  traffic.className = "traffic";

  // User request: wire the traffic lights (red/yellow/green) to close.
  const close = () => opts.onClose();
  const red = buttonDot("red", "Close", close);
  red.setAttribute("data-close-overlay", "1");
  const yellow = buttonDot("yellow", "Close", close);
  const green = buttonDot("green", "Close", close);
  traffic.appendChild(red);
  traffic.appendChild(yellow);
  traffic.appendChild(green);

  const title = document.createElement("div");
  title.className = "macos-title";
  title.textContent = "Portfolio";

  const titlebarRight = document.createElement("div");
  titlebarRight.className = "macos-titlebar-right";

  const themeBtn = document.createElement("button");
  themeBtn.type = "button";
  themeBtn.className = "theme-toggle";
  themeBtn.setAttribute("aria-label", "Toggle theme");
  titlebarRight.appendChild(themeBtn);

  titlebar.appendChild(traffic);
  titlebar.appendChild(title);
  titlebar.appendChild(titlebarRight);

  const body = document.createElement("div");
  body.className = "macos-body";

  const content = document.createElement("main");
  content.className = "macos-content";

  const md = document.createElement("div");
  md.className = "md";
  content.appendChild(md);

  body.appendChild(content);

  win.appendChild(titlebar);
  win.appendChild(body);

  overlay.appendChild(win);
  root.appendChild(overlay);

  function openPage(id: string) {
    setHashParam("page", id, "replace");
    void loadPage(id);
  }

  let theme: Theme = getInitialTheme();
  function applyTheme(next: Theme) {
    theme = next;
    overlay.dataset.theme = next;
    themeBtn.textContent = `[t] theme: ${next}`;
    try {
      localStorage.setItem("overlayTheme", next);
    } catch {
      // ignore
    }
  }
  function toggleTheme() {
    applyTheme(theme === "dark" ? "light" : "dark");
  }
  themeBtn.addEventListener("click", toggleTheme);
  applyTheme(theme);

  function renderHome() {
    md.classList.add("md-home");
    md.innerHTML = "";

    const rootEl = document.createElement("div");
    rootEl.className = "tui";

    rootEl.appendChild(createTuiLine("$ portfolio --help", "plain"));
    rootEl.appendChild(createTuiLine("Commands:", "muted"));

    const menu = document.createElement("div");
    menu.className = "tui-menu";

    const cards: Array<{ id: string; title: string; desc: string; shortcut: string }> = [
      { id: "projects", title: "projects", desc: "Selected work, demos, links.", shortcut: "1" },
      { id: "writing", title: "writing", desc: "Posts and notes (content/writing/).", shortcut: "2" },
      { id: "about", title: "about", desc: "Short bio, skills, interests.", shortcut: "3" },
      { id: "contact", title: "contact", desc: "Where to reach me.", shortcut: "4" },
    ];

    const pageIds = new Set(allPages.map((p) => p.id));
    const hasAnyWriting = allPages.some((p) => p.id.startsWith("writing/") || p.id.startsWith("blog/"));
    const canOpen = (id: string) => pageIds.has(id) || (id === "writing" && hasAnyWriting);

    for (const c of cards) {
      const btn = document.createElement("button");
      btn.type = "button";
      btn.className = "tui-menu-item";
      btn.innerHTML = `<span class="tui-prompt">&gt;</span> <span class="tui-kbd">[${c.shortcut}]</span> <span class="tui-cmd">${c.title}</span> <span class="tui-sep">-</span> <span class="tui-desc">${c.desc}</span>`;

      const enabled = canOpen(c.id);
      btn.disabled = !enabled;
      btn.addEventListener("click", () => {
        if (!enabled) return;

        if (c.id === "writing" && !pageIds.has("writing")) {
          const firstWriting = allPages.find((p) => p.id.startsWith("writing/") || p.id.startsWith("blog/"));
          if (firstWriting) openPage(firstWriting.id);
          return;
        }

        openPage(c.id);
      });

      menu.appendChild(btn);
    }
    rootEl.appendChild(menu);

    const index = document.createElement("div");
    index.className = "tui-index";
    index.appendChild(createTuiLine("$ ls content", "plain"));

    const indexList = document.createElement("div");
    indexList.className = "tui-index-list";

    const mdPages = allPages.filter((p) => p.kind === "md");
    for (const p of mdPages) {
      const btn = document.createElement("button");
      btn.type = "button";
      btn.className = "tui-link";
      const prettyPath = (p.srcPath || "").replace(/^\/content\//, "content/");
      btn.textContent = `- ${prettyPath || p.title}`;
      btn.addEventListener("click", () => openPage(p.id));
      indexList.appendChild(btn);
    }
    if (!mdPages.length) indexList.appendChild(createTuiLine("(empty)", "muted"));

    index.appendChild(indexList);
    rootEl.appendChild(index);

    const recent = document.createElement("div");
    recent.className = "tui-recent";
    recent.appendChild(createTuiLine("$ ls content/writing", "plain"));

    const writingPages = allPages.filter(
      (p) => p.kind === "md" && (p.id.startsWith("writing/") || p.id.startsWith("blog/")),
    );

    const list = document.createElement("div");
    list.className = "tui-recent-list";

    if (!writingPages.length) {
      list.appendChild(createTuiLine("No writing pages yet. Add markdown in content/writing/.", "muted"));
    } else {
      for (const p of writingPages.slice(0, 5)) {
        const btn = document.createElement("button");
        btn.type = "button";
        btn.className = "tui-link";
        btn.textContent = `- ${p.title}`;
        btn.addEventListener("click", () => openPage(p.id));
        list.appendChild(btn);
      }
    }

    recent.appendChild(list);
    rootEl.appendChild(recent);

    const tip = document.createElement("div");
    tip.className = "tui-tip";
    tip.appendChild(createTuiLine("Keys: [h] home, [1-4] open section, [t] theme toggle.", "good"));
    tip.appendChild(createTuiLine("Scene: Left/Right arrows cycle POIs. Esc closes overlay.", "muted"));
    rootEl.appendChild(tip);

    md.appendChild(rootEl);
  }

  let loadSeq = 0;
  async function loadPage(id: string) {
    const page = allPages.find((p) => p.id === id) || allPages[0];
    if (!page) {
      md.innerHTML = `<p>No markdown files found in <code>content/</code>.</p>`;
      return;
    }

    title.textContent = page.title;

    const seq = ++loadSeq;
    md.classList.remove("md-home");
    md.innerHTML = "";
    const loading = document.createElement("div");
    loading.className = "tui";
    loading.appendChild(createTuiLine("$ loading...", "muted"));
    md.appendChild(loading);

    try {
      if (page.kind === "home") {
        if (seq !== loadSeq) return;
        renderHome();
        return;
      }

      const raw = await page.load?.();
      if (seq !== loadSeq) return;
      md.innerHTML = "";

      const header = document.createElement("div");
      header.className = "tui tui-md-head";
      const prettyPath = (page.srcPath || "").replace(/^\/content\//, "content/");
      header.appendChild(createTuiLine(`$ cat ${prettyPath || page.title}`, "plain"));
      header.appendChild(createTuiLine("Keys: [h] home, [t] theme, [esc] close", "muted"));
      md.appendChild(header);

      const article = document.createElement("div");
      article.className = "md-article";
      article.innerHTML = await marked.parse(raw || "");
      md.appendChild(article);
    } catch (err) {
      console.error(err);
      if (seq !== loadSeq) return;
      md.innerHTML = `<p>Failed to load <code>${page.title}</code>.</p>`;
    }
  }

  // Initial page selection: respect URL if present.
  const fromHash = (getHashParam("page") || "").toLowerCase();
  const initial =
    (fromHash && allPages.some((p) => p.id === fromHash) ? fromHash : null) || allPages[0]?.id || "home";
  if (initial) {
    if (!fromHash) setHashParam("page", initial, "replace");
    void loadPage(initial);
  }

  // Focus management: move focus into the overlay, return focus on close.
  const prevActive = document.activeElement as HTMLElement | null;
  red.focus();

  const onKeyDown = (e: KeyboardEvent) => {
    if (e.key === "Escape") opts.onClose();

    // TUI-style shortcuts on the home page.
    const overlayParam = (getHashParam("overlay") || "").toLowerCase();
    if (overlayParam !== "macos") return;
    if (e.key === "t" || e.key === "T") toggleTheme();
    if (e.key === "h" || e.key === "H") openPage("home");
    if (e.key === "1") openPage("projects");
    if (e.key === "2") openPage("writing");
    if (e.key === "3") openPage("about");
    if (e.key === "4") openPage("contact");
  };
  window.addEventListener("keydown", onKeyDown);

  return () => {
    window.removeEventListener("keydown", onKeyDown);
    root.innerHTML = "";
    prevActive?.focus?.();
  };
}
