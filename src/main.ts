import * as THREE from "three";
import { OrbitControls } from "three/examples/jsm/controls/OrbitControls.js";
import { GLTFLoader } from "three/examples/jsm/loaders/GLTFLoader.js";
import { inject as injectVercelAnalytics } from "@vercel/analytics";
import { injectSpeedInsights } from "@vercel/speed-insights";
import { createBootLog, describeGpu, mb } from "./boot";
import { createMacScreen, type MacScreen, type ScreenLine } from "./macScreen";
import { track } from "./analytics";
import { createHints } from "./hints";

type Poi = {
  id: string;
  label: string;
  anchor: THREE.Object3D;
};

function qs<T extends Element>(sel: string): T {
  const el = document.querySelector(sel);
  if (!el) throw new Error(`Missing element: ${sel}`);
  return el as T;
}

const canvas = qs<HTMLCanvasElement>("#c");
const prevBtn = qs<HTMLButtonElement>("#prev");
const nextBtn = qs<HTMLButtonElement>("#next");
const helpBtn = qs<HTMLButtonElement>("#help");
const poiLabel = qs<HTMLSpanElement>("#poi-label");
const poiAction = qs<HTMLButtonElement>("#poi-action");
const hudTabs = qs<HTMLDivElement>("#hud-tabs");
const hints = createHints(qs<HTMLSpanElement>("#hud-hint"));
const isTouch = () => window.matchMedia?.("(hover: none)")?.matches ?? false;
const overlayRoot = qs<HTMLDivElement>("#overlay-root");
const annotationLayer = qs<HTMLDivElement>("#annotation-layer");
const appRoot = qs<HTMLDivElement>("#app");

// Boot log first so it can report everything below, including failures.
const boot = createBootLog(() => {
  if (boot.active) track("skip_text_mode", { at_ms: Math.round(performance.now()) });
  setHashParam("overlay", "macos");
});

// Vercel Web Analytics + Speed Insights (no-op locally; active on Vercel deployments).
injectVercelAnalytics();
injectSpeedInsights();

function createAnnotation() {
  const el = document.createElement("div");
  el.className = "annotation";
  el.innerHTML = `<span class="dot"></span><span class="text"></span>`;
  annotationLayer.appendChild(el);
  return el;
}

function setAnnotationText(el: HTMLElement, text: string) {
  const t = el.querySelector(".text");
  if (t) t.textContent = text;
}

function easeInOutCubic(t: number) {
  return t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2;
}

// Render-on-demand scheduler (manual: rendering on demand)
let renderRequested = false;
function requestRenderIfNotRequested(render: () => void) {
  if (renderRequested) return;
  renderRequested = true;
  requestAnimationFrame(() => render());
}

const MAX_DPR = 2;

function resizeRendererToDisplaySize(renderer: THREE.WebGLRenderer, camera: THREE.PerspectiveCamera) {
  const { clientWidth, clientHeight } = renderer.domElement;
  const dpr = Math.min(window.devicePixelRatio || 1, MAX_DPR);
  const width = Math.max(1, Math.floor(clientWidth * dpr));
  const height = Math.max(1, Math.floor(clientHeight * dpr));
  const needResize = renderer.domElement.width !== width || renderer.domElement.height !== height;
  if (!needResize) return false;

  renderer.setPixelRatio(dpr);
  renderer.setSize(clientWidth, clientHeight, false);
  camera.aspect = clientWidth / clientHeight;
  camera.updateProjectionMatrix();
  return true;
}

function projectToScreen(v: THREE.Vector3, camera: THREE.PerspectiveCamera, canvasEl: HTMLCanvasElement) {
  const p = v.clone().project(camera);
  const rect = canvasEl.getBoundingClientRect();
  const x = (p.x * 0.5 + 0.5) * rect.width + rect.left;
  const y = (-p.y * 0.5 + 0.5) * rect.height + rect.top;
  const visible = p.z >= -1 && p.z <= 1;
  return { x, y, visible };
}

function setHashParams(updates: Record<string, string | null>, mode: "push" | "replace" = "push") {
  const raw = location.hash.startsWith("#") ? location.hash.slice(1) : location.hash;
  const params = new URLSearchParams(raw);
  for (const [key, value] of Object.entries(updates)) {
    if (value == null) params.delete(key);
    else params.set(key, value);
  }
  const next = params.toString();
  if (mode === "replace") {
    history.replaceState(null, "", next ? `#${next}` : "#");
    return;
  }

  // Setting location.hash creates a history entry, which we want for POI/overlay navigation.
  location.hash = next;
}

function setHashParam(key: string, value: string | null, mode: "push" | "replace" = "push") {
  setHashParams({ [key]: value }, mode);
}

function getHashParam(key: string) {
  const raw = location.hash.startsWith("#") ? location.hash.slice(1) : location.hash;
  return new URLSearchParams(raw).get(key);
}

// The guided tour. Other POI_*_ANCHOR nodes in the scene (posters) are set
// dressing: present in the room, not stops in the tour.
// `hint` is the in-scene label; the Mac has none because its screen says it.
const TOUR: { id: string; label: string; verb: string; external?: boolean; hint: string | null }[] = [
  { id: "mac", label: "portfolio", verb: "open", hint: null },
  { id: "arcade", label: "hoopzy", verb: "play", external: true, hint: "hoopzy · play ↗" },
];
const HOOPZY_URL = "https://hoopzy.fun";

function findPois(root: THREE.Object3D): Poi[] {
  const anchors = new Map<string, THREE.Object3D>();
  root.traverse((obj: THREE.Object3D) => {
    const nm = obj.name || "";
    if (!nm.startsWith("POI_") || !nm.endsWith("_ANCHOR")) return;
    // POI_<ID>_ANCHOR
    anchors.set(nm.slice("POI_".length, nm.length - "_ANCHOR".length).toLowerCase(), obj);
  });
  return TOUR.flatMap((t) => {
    const anchor = anchors.get(t.id);
    return anchor ? [{ id: t.id, label: t.label, anchor }] : [];
  });
}

const tourEntry = (id: string) => TOUR.find((t) => t.id === id);

let overlayUnmount: (() => void) | null = null;
let overlayOpening: Promise<void> | null = null;

async function openMacOverlayInternal() {
  if (overlayUnmount || overlayOpening) return;
  controls.enabled = false;

  overlayOpening = (async () => {
    // Start fetching the overlay chunk while the camera moves into the screen.
    const modP = import("./overlay/macos");
    hints.clear();
    window.clearTimeout(orbitHintTimer);
    await zoomIntoScreen();
    overlayRoot.hidden = false;
    const mod = await modP;
    overlayUnmount = mod.mountMacOverlay(overlayRoot, {
      onClose: () => {
        // Drive state via URL so back/forward works.
        setHashParam("overlay", null);
      },
    });
    overlayOpening = null;

    // If the user navigated away while the module was loading, immediately close.
    const overlay = (getHashParam("overlay") || "").toLowerCase();
    if (overlay !== "macos") closeMacOverlayInternal();
  })().catch((err) => {
    overlayOpening = null;
    console.error(err);
    closeMacOverlayInternal();
  });

  await overlayOpening;
}

function closeMacOverlayInternal() {
  overlayRoot.hidden = true;
  if (!overlayUnmount) return;

  overlayUnmount();
  overlayUnmount = null;
  if (!transition) controls.enabled = true;

  // Pull back out of the screen to the active POI.
  const poi = pois[activePoiIndex];
  if (poi && gltfRoot) focusOnPoi(poi, { durationMs: 900 });

  // After their first look at the work, point them at the game.
  if (pois.some((p) => p.id === "arcade")) {
    window.setTimeout(() => {
      if (!overlayRoot.hidden || pois[activePoiIndex]?.id !== "mac") return;
      hints.show("arcade", isTouch() ? "tip: tap 2:hoopzy to visit the arcade" : "tip: → or 2 visits the arcade");
    }, 1100);
  }
  requestRenderIfNotRequested(render);
}

/** Camera pose that fills the frame with the Mac's display (any aspect ratio). */
function screenCloseUpPose() {
  if (!macScreen) return null;
  resizeRendererToDisplaySize(renderer, camera);
  const halfTan = Math.tan(THREE.MathUtils.degToRad(camera.fov / 2));
  const fitW = 0.29 / (halfTan * camera.aspect);
  const fitH = 0.18 / halfTan;
  const dist = Math.min(fitW, fitH) * 0.9;
  return {
    pos: macScreen.center.clone().addScaledVector(macScreen.normal, dist),
    target: macScreen.center.clone(),
  };
}

/** Move the camera into the Mac's screen before the overlay takes over. */
function zoomIntoScreen() {
  const pose = screenCloseUpPose();
  if (!pose || prefersReducedMotion()) return Promise.resolve();
  if (camera.position.distanceTo(pose.pos) < 0.01) return Promise.resolve();
  return new Promise<void>((resolve) => {
    transition = {
      startT: performance.now(),
      durationMs: 650,
      fromPos: camera.position.clone(),
      fromTarget: controls.target.clone(),
      toPos: pose.pos,
      toTarget: pose.target,
      onDone: resolve,
    };
    requestRenderIfNotRequested(render);
  });
}

// Three.js setup
function createRenderer() {
  try {
    return new THREE.WebGLRenderer({ canvas, antialias: true, powerPreference: "high-performance" });
  } catch (err) {
    console.error(err);
    return null;
  }
}

const maybeRenderer = createRenderer();
if (!maybeRenderer) {
  boot.line("webgl2 unavailable → text mode", "warn");
  void import("./overlay/macos").then((mod) => {
    overlayRoot.hidden = false;
    mod.mountMacOverlay(overlayRoot, { onClose: () => {} });
  });
  throw new Error("WebGL unavailable");
}
const renderer: THREE.WebGLRenderer = maybeRenderer;
{
  const rawDpr = window.devicePixelRatio || 1;
  const capped = Math.min(rawDpr, MAX_DPR);
  const dprText = capped < rawDpr ? `dpr ${rawDpr} → capped ${capped}` : `dpr ${rawDpr}`;
  boot.line(`webgl2 ok · ${describeGpu(renderer.getContext())} · ${dprText}`);
}
renderer.setClearColor(0x000000, 0);

// Color management (per three.js manual; avoid manual gamma hacks).
renderer.outputColorSpace = THREE.SRGBColorSpace;

// A little tone mapping + exposure helps PBR assets read better without an HDR environment.
renderer.toneMapping = THREE.ACESFilmicToneMapping;
renderer.toneMappingExposure = 1.15;

const scene = new THREE.Scene();
const camera = new THREE.PerspectiveCamera(45, 2, 0.01, 200);
camera.position.set(2.5, 1.5, 2.5);

const controls = new OrbitControls(camera, canvas);
controls.enableDamping = false;
controls.enabled = false;
controls.enablePan = false;
controls.enableZoom = true;
controls.minDistance = 0.6;
controls.maxDistance = 3.2;
controls.minPolarAngle = Math.PI * 0.18;
controls.maxPolarAngle = Math.PI * 0.55;
controls.addEventListener("change", () => requestRenderIfNotRequested(render));
controls.addEventListener("start", () => hints.followed("orbit"));

// Cheap "studio" lighting: no shadows, just a key + fill + hemisphere.
const hemi = new THREE.HemisphereLight(0xdde9ff, 0x0b0c10, 1.0);
scene.add(hemi);

const key = new THREE.DirectionalLight(0xffffff, 0.95);
key.position.set(2.2, 4.2, 2.6);
scene.add(key);
scene.add(key.target);

const fill = new THREE.DirectionalLight(0xbfd7ff, 0.35);
fill.position.set(-2.4, 2.2, -1.8);
scene.add(fill);
scene.add(fill.target);

const loader = new GLTFLoader();

let gltfRoot: THREE.Object3D | null = null;
let macRoot: THREE.Object3D | null = null;
let macScreen: MacScreen | null = null;
let pois: Poi[] = [];
let activePoiIndex = -1;

const annotationEl = createAnnotation();
setAnnotationText(annotationEl, "");

// Help modal (shown on first load, and toggleable via ?)
let helpOpen = false;
let restoreFocusEl: HTMLElement | null = null;
let controlsEnabledBeforeHelp = false;

const helpModal = document.createElement("div");
helpModal.id = "help-modal";
helpModal.hidden = true;
helpModal.setAttribute("role", "dialog");
helpModal.setAttribute("aria-modal", "true");
helpModal.setAttribute("aria-labelledby", "help-title");
helpModal.innerHTML = `
  <div class="help-scrim" data-close-help="1"></div>
  <div class="help-card" role="document">
    <div class="help-head" aria-hidden="true">
      <span>PORTFOLIO(1)</span><span class="help-head-mid">genialtechie manual</span><span>PORTFOLIO(1)</span>
    </div>
    <h2 class="help-title" id="help-title">portfolio — a room you can look around</h2>
    <div class="help-body" id="help-desc">
      <h3>CONTROLS</h3>
      <dl class="help-keys">
        <dt><kbd>←</kbd> <kbd>→</kbd> or <kbd>1</kbd> <kbd>2</kbd></dt><dd>move between the MacBook and the arcade</dd>
        <dt><kbd>enter</kbd> or click</dt><dd>open what you're looking at</dd>
        <dt>drag</dt><dd>orbit a little around it</dd>
        <dt><kbd>esc</kbd></dt><dd>close the portfolio</dd>
        <dt><kbd>?</kbd></dt><dd>this page</dd>
      </dl>
      <p class="help-touch">On touch screens: tap the tabs below to move, tap the Mac to open.</p>

      <details class="help-details">
        <summary>CREDITS <span>3D models, CC BY 4.0</span></summary>
        <div class="help-credits">
          <p>
            "<a href="https://skfb.ly/6SBrS" target="_blank" rel="noopener noreferrer">Final Fight Arcade</a>" by brysew is
            licensed under
            <a href="http://creativecommons.org/licenses/by/4.0/" target="_blank" rel="noopener noreferrer"
              >Creative Commons Attribution</a
            >.
          </p>
          <p>
            "<a href="https://skfb.ly/oWSpq" target="_blank" rel="noopener noreferrer">MacBook Laptop</a>" by Issac
            Ghazanfar is licensed under
            <a href="http://creativecommons.org/licenses/by/4.0/" target="_blank" rel="noopener noreferrer"
              >Creative Commons Attribution</a
            >.
          </p>
          <p>
            "<a href="https://skfb.ly/oGP7t" target="_blank" rel="noopener noreferrer">Work Table</a>" by rickmaolly is
            licensed under
            <a href="http://creativecommons.org/licenses/by/4.0/" target="_blank" rel="noopener noreferrer"
              >Creative Commons Attribution</a
            >.
          </p>
          <p>
            "<a href="https://skfb.ly/6R7A9" target="_blank" rel="noopener noreferrer">Wall Floor Model Corner Room</a>" by
            Aerial_Knight is licensed under
            <a href="http://creativecommons.org/licenses/by/4.0/" target="_blank" rel="noopener noreferrer"
              >Creative Commons Attribution</a
            >.
          </p>
          <p>
            "<a href="https://skfb.ly/oFYwq" target="_blank" rel="noopener noreferrer">Neon_ Posters</a>" by Seniora_Kora is
            licensed under
            <a href="http://creativecommons.org/licenses/by/4.0/" target="_blank" rel="noopener noreferrer"
              >Creative Commons Attribution</a
            >.
          </p>
        </div>
      </details>
    </div>
    <button type="button" class="help-close" data-close-help="1" aria-label="Close help">[esc] close</button>
  </div>
`;
appRoot.appendChild(helpModal);

helpBtn.setAttribute("aria-controls", "help-modal");
helpBtn.setAttribute("aria-expanded", "false");

function openHelp() {
  if (helpOpen) return;
  helpOpen = true;
  restoreFocusEl = document.activeElement as HTMLElement | null;
  helpBtn.setAttribute("aria-expanded", "true");
  helpModal.hidden = false;

  controlsEnabledBeforeHelp = controls.enabled;
  controls.enabled = false;
  requestRenderIfNotRequested(render);

  const closeBtn = helpModal.querySelector<HTMLButtonElement>(".help-close");
  closeBtn?.focus?.();
}

function closeHelp(markSeen = true) {
  if (!helpOpen) return;
  helpOpen = false;
  helpBtn.setAttribute("aria-expanded", "false");
  helpModal.hidden = true;

  if (markSeen) {
    try {
      localStorage.setItem("helpSeen.v1", "1");
    } catch {
      // ignore
    }
  }

  if (overlayRoot.hidden && !transition) {
    controls.enabled = controlsEnabledBeforeHelp;
    requestRenderIfNotRequested(render);
  }

  restoreFocusEl?.focus?.();
  restoreFocusEl = null;
}

function toggleHelp() {
  if (helpOpen) closeHelp(false);
  else openHelp();
}

helpBtn.addEventListener("click", () => toggleHelp());
helpModal.addEventListener("click", (e) => {
  const t = e.target as HTMLElement | null;
  if (!t) return;
  if (t.closest("[data-close-help]")) closeHelp(true);
});

function setActivePoiIndex(nextIndex: number, opts: { durationMs?: number } = {}) {
  if (!pois.length) return;
  activePoiIndex = (nextIndex + pois.length) % pois.length;
  const poi = pois[activePoiIndex]!;
  poiLabel.textContent = "";
  const entry = tourEntry(poi.id);
  poiAction.hidden = !entry;
  if (entry) {
    poiAction.innerHTML = `<kbd>↵</kbd> ${entry.verb} <b>${entry.label}</b>${entry.external ? " ↗" : ""}`;
  }
  for (const tab of hudTabs.querySelectorAll<HTMLButtonElement>("button")) {
    const on = tab.dataset.poi === poi.id;
    tab.classList.toggle("is-active", on);
    tab.setAttribute("aria-current", on ? "true" : "false");
  }
  setAnnotationText(annotationEl, entry?.hint ?? "");
  annotationEl.hidden = !entry?.hint;
  focusOnPoi(poi, opts);

  if (poi.id === "arcade") {
    hints.followed("arcade");
    // Explain what the arcade is once the camera arrives.
    window.setTimeout(() => {
      if (pois[activePoiIndex]?.id !== "arcade" || !overlayRoot.hidden) return;
      hints.show("arcade-intro", `hoopzy · a game I built · ${isTouch() ? "tap" : "↵"} to play`);
    }, 900);
  }
}

// "Drag to look around": only after sitting still on a stop for a while.
const ORBIT_HINT_IDLE_MS = 10_000;
let orbitHintTimer = 0;
function armOrbitHint() {
  window.clearTimeout(orbitHintTimer);
  if (hints.seen("orbit")) return;
  orbitHintTimer = window.setTimeout(() => {
    if (!overlayRoot.hidden || helpOpen || transition || appRoot.hasAttribute("data-booting")) return;
    hints.show("orbit", "tip: drag to look around");
  }, ORBIT_HINT_IDLE_MS);
}
for (const type of ["pointerdown", "keydown", "wheel"] as const) {
  window.addEventListener(type, () => window.clearTimeout(orbitHintTimer), { passive: true });
}

/** The one thing each stop does. */
function runPoiAction(poi: Poi | undefined, via: "click" | "enter" | "button") {
  if (!poi) return;
  if (poi.id === "mac") {
    track("open_portfolio", { via });
    setHashParams({ poi: "mac", overlay: "macos" });
  } else if (poi.id === "arcade") {
    track("play_hoopzy", { via });
    hints.followed("arcade-intro");
    window.open(HOOPZY_URL, "_blank", "noopener");
  }
}

let transition:
  | {
      startT: number;
      durationMs: number;
      fromPos: THREE.Vector3;
      fromTarget: THREE.Vector3;
      toPos: THREE.Vector3;
      toTarget: THREE.Vector3;
      onDone?: () => void;
    }
  | null = null;

const tmpV = new THREE.Vector3();
const tmpV2 = new THREE.Vector3();
const tmpBox = new THREE.Box3();

const prefersReducedMotion = () =>
  window.matchMedia?.("(prefers-reduced-motion: reduce)")?.matches ?? false;

function poiPose(poi: Poi) {
  const target = poi.anchor.getWorldPosition(tmpV).clone();

  // Keep camera inside the room by looking from target toward the scene center.
  const center = tmpBox.setFromObject(gltfRoot!).getCenter(tmpV2).clone();
  const dirToCenter = center.clone().sub(target).normalize();

  // Portrait screens have a narrow horizontal view: step back so the prop fits.
  resizeRendererToDisplaySize(renderer, camera);
  const distance = 1.7 / Math.sqrt(Math.min(1, camera.aspect / 0.9));
  const height = 0.45;
  const camPos = target
    .clone()
    .add(dirToCenter.clone().multiplyScalar(distance))
    .add(new THREE.Vector3(0, height, 0));

  return { target, camPos, dirToCenter };
}

function focusOnPoi(poi: Poi, opts: { durationMs?: number } = {}) {
  if (!gltfRoot) return;

  const durationMs = prefersReducedMotion() ? 0 : (opts.durationMs ?? 750);
  const { target, camPos } = poiPose(poi);

  controls.enabled = false;

  // Anything awaiting the interrupted transition shouldn't hang.
  transition?.onDone?.();

  if (!durationMs) {
    transition = null;
    camera.position.copy(camPos);
    controls.target.copy(target);
    controls.update();
    controls.enabled = true;
    requestRenderIfNotRequested(render);
    return;
  }

  transition = {
    startT: performance.now(),
    durationMs,
    fromPos: camera.position.clone(),
    fromTarget: controls.target.clone(),
    toPos: camPos,
    toTarget: target,
  };

  requestRenderIfNotRequested(render);
}

function nextPoi() {
  if (!pois.length) return;
  const nextIndex = activePoiIndex + 1;
  const p = pois[(nextIndex + pois.length) % pois.length]!;
  setHashParam("poi", p.id);
}

function prevPoi() {
  if (!pois.length) return;
  const prevIndex = activePoiIndex - 1;
  const p = pois[(prevIndex + pois.length) % pois.length]!;
  setHashParam("poi", p.id);
}

prevBtn.addEventListener("click", () => prevPoi());
nextBtn.addEventListener("click", () => nextPoi());

poiAction.addEventListener("click", () => runPoiAction(pois[activePoiIndex], "button"));

window.addEventListener("keydown", (e) => {
  if (appRoot.hasAttribute("data-booting")) return; // boot log owns Enter while loading

  if (!overlayRoot.hidden) {
    if (e.key === "Escape") {
      // Close via URL so it works even if the overlay module is still loading.
      setHashParam("overlay", null);
    }
    return;
  }

  if (helpOpen) {
    if (e.key === "Escape" || e.key === "?") closeHelp(true);
    return;
  }

  if (e.key === "?") openHelp();
  if (e.key === "ArrowLeft") prevPoi();
  if (e.key === "ArrowRight") nextPoi();
  // Number keys jump to a stop, matching the "1:portfolio 2:hoopzy" tabs.
  const n = Number(e.key);
  if (Number.isInteger(n) && n >= 1 && n <= pois.length) setHashParam("poi", pois[n - 1]!.id);

  // Enter runs the current stop's action, unless a control has focus (it handles Enter itself).
  const focused = document.activeElement;
  if (e.key === "Enter" && (focused === document.body || focused === canvas)) {
    runPoiAction(pois[activePoiIndex], "enter");
  }
});

// Pointer interactions. Hit-testing uses the props' bounding boxes: it's cheap
// enough to run on hover (the MacBook alone is ~140k triangles) and generous
// enough to be an easy target.
const raycaster = new THREE.Raycaster();
const ndc = new THREE.Vector2();
const hitTargets: { id: string; box: THREE.Box3 }[] = [];
const tmpHit = new THREE.Vector3();

function poiAt(clientX: number, clientY: number) {
  const rect = canvas.getBoundingClientRect();
  ndc.x = ((clientX - rect.left) / rect.width) * 2 - 1;
  ndc.y = -(((clientY - rect.top) / rect.height) * 2 - 1);
  raycaster.setFromCamera(ndc, camera);
  let best: { id: string; d: number } | null = null;
  for (const t of hitTargets) {
    if (!raycaster.ray.intersectBox(t.box, tmpHit)) continue;
    const d = tmpHit.distanceTo(raycaster.ray.origin);
    if (!best || d < best.d) best = { id: t.id, d };
  }
  return best?.id ?? null;
}

// One click/tap: on the current stop it runs the action; on another prop it goes there.
// Drags (orbiting) never count as clicks.
const TAP_MOVE_PX = 8;
let press: { id: number; x: number; y: number; moved: boolean } | null = null;

canvas.addEventListener("pointerdown", (e) => {
  press = { id: e.pointerId, x: e.clientX, y: e.clientY, moved: false };
});

canvas.addEventListener("pointermove", (e) => {
  if (press && e.pointerId === press.id) {
    const dx = e.clientX - press.x;
    const dy = e.clientY - press.y;
    if (dx * dx + dy * dy > TAP_MOVE_PX * TAP_MOVE_PX) press.moved = true;
    return;
  }
  if (e.pointerType === "mouse" && !transition) {
    canvas.style.cursor = poiAt(e.clientX, e.clientY) ? "pointer" : "";
  }
});

canvas.addEventListener("pointerup", (e) => {
  const p = press;
  press = null;
  if (!p || p.id !== e.pointerId || p.moved || !gltfRoot) return;
  if (!overlayRoot.hidden || helpOpen || appRoot.hasAttribute("data-booting")) return;

  const id = poiAt(e.clientX, e.clientY);
  if (!id) return;
  const active = pois[activePoiIndex];
  if (active?.id === id) runPoiAction(active, "click");
  else setHashParam("poi", id);
});

canvas.addEventListener("pointercancel", () => {
  press = null;
});

function render() {
  renderRequested = false;

  resizeRendererToDisplaySize(renderer, camera);

  // Camera transition animation
  if (transition) {
    const now = performance.now();
    const t = Math.min(1, (now - transition.startT) / transition.durationMs);
    const k = easeInOutCubic(t);

    camera.position.lerpVectors(transition.fromPos, transition.toPos, k);
    controls.target.lerpVectors(transition.fromTarget, transition.toTarget, k);
    // lookAt instead of controls.update(): OrbitControls clamps to minDistance,
    // which would snap the intro's close-up out to the orbit range.
    camera.lookAt(controls.target);

    if (t >= 1) {
      const done = transition.onDone;
      transition = null;
      controls.update();
      controls.enabled = overlayRoot.hidden;
      if (overlayRoot.hidden) armOrbitHint();
      done?.();
    } else {
      requestRenderIfNotRequested(render);
    }
  }

  // Annotation for active POI
  if (pois.length && activePoiIndex >= 0) {
    const poi = pois[activePoiIndex]!;
    const wpos = poi.anchor.getWorldPosition(tmpV);
    const p = projectToScreen(wpos, camera, canvas);

    annotationEl.style.opacity = p.visible ? "1" : "0";
    if (p.visible) {
      annotationEl.style.transform = `translate3d(${Math.round(p.x)}px, ${Math.round(p.y)}px, 0)`;
    }
  }

  renderer.render(scene, camera);
}

function countGeometry(root: THREE.Object3D) {
  let verts = 0;
  let tris = 0;
  let meshes = 0;
  const textures = new Set<THREE.Texture>();
  root.traverse((o) => {
    const mesh = o as THREE.Mesh;
    if (!mesh.isMesh) return;
    meshes++;
    const g = mesh.geometry;
    verts += g.attributes.position?.count ?? 0;
    tris += (g.index ? g.index.count : (g.attributes.position?.count ?? 0)) / 3;
    const mats = Array.isArray(mesh.material) ? mesh.material : [mesh.material];
    for (const m of mats) {
      for (const v of Object.values(m)) if ((v as THREE.Texture)?.isTexture) textures.add(v as THREE.Texture);
    }
  });
  return { verts, tris, meshes, textures: [...textures] };
}

/** Uncompressed RGBA8 + full mip chain (~4/3). A proxy, not a driver-exact number. */
function estimateVramBytes(textures: THREE.Texture[]) {
  let bytes = 0;
  for (const t of textures) {
    const img = t.image as { width?: number; height?: number } | undefined;
    if (img?.width && img.height) bytes += img.width * img.height * 4 * (t.generateMipmaps ? 4 / 3 : 1);
  }
  return bytes;
}

const k = (n: number) => (n >= 1000 ? `${(n / 1000).toFixed(1)}k` : String(Math.round(n)));
const secs = (ms: number) => `${(ms / 1000).toFixed(2)}s`;

async function loadScene() {
  const t0 = performance.now();
  let tFetched = 0;
  const total = __SCENE_BYTES__;

  const slowTimer = window.setTimeout(() => {
    boot.line("slow network · [enter] for text mode while this finishes", "warn");
  }, 8000);

  try {
    const gltf = await loader.loadAsync("/scene.glb", (e) => {
      const tot = e.lengthComputable && e.total ? e.total : total;
      boot.progress("fetch scene.glb", e.loaded, tot);
      if (e.loaded >= tot && !tFetched) tFetched = performance.now();
    });
    if (!tFetched) tFetched = performance.now();
    boot.progressDone(`fetch scene.glb · ${mb(total)} MB in ${secs(tFetched - t0)}`);
    return { gltf, tFetched };
  } finally {
    window.clearTimeout(slowTimer);
  }
}

async function init() {
  const { gltf, tFetched } = await loadScene();
  gltfRoot = gltf.scene;

  // Normalize units: the room appears authored in inches; scale scene to meters.
  gltfRoot.scale.setScalar(0.0254);
  scene.add(gltfRoot);

  const geo = countGeometry(gltfRoot);
  boot.line(
    `parse gltf · ${k(geo.verts)} verts · ${k(geo.tris)} tris · ${geo.meshes} meshes · ${secs(performance.now() - tFetched)}`,
  );

  // Aim key/fill at the scene center so relayouts of the GLB don't break the look.
  const center = tmpBox.setFromObject(gltfRoot).getCenter(tmpV2);
  key.target.position.copy(center);
  fill.target.position.copy(center);

  // POIs
  pois = findPois(gltfRoot);
  for (const p of pois) p.anchor.visible = false;

  // Mac root (click target + where the screen lives)
  macRoot =
    gltfRoot.getObjectByName("macbook.glb") ??
    gltfRoot.getObjectByProperty("name", "macbook.glb") ??
    null;
  if (!macRoot) {
    gltfRoot.traverse((o: THREE.Object3D) => {
      if (macRoot) return;
      if ((o.name || "").toLowerCase().includes("macbook")) macRoot = o;
    });
  }

  // Status-bar tabs, one per stop (tmux-style "1:portfolio 2:hoopzy").
  hudTabs.replaceChildren(
    ...pois.map((p, i) => {
      const b = document.createElement("button");
      b.type = "button";
      b.dataset.poi = p.id;
      b.innerHTML = `<span class="n">${i + 1}:</span>${p.label}`;
      b.addEventListener("click", () => setHashParam("poi", p.id));
      return b;
    }),
  );

  // Click/hover targets for the tour stops.
  gltfRoot.updateMatrixWorld(true);
  const arcadeRoot = gltfRoot.getObjectByName("final_fight_arcade.glb");
  for (const [id, obj] of [["mac", macRoot], ["arcade", arcadeRoot]] as const) {
    if (obj && pois.some((p) => p.id === id)) hitTargets.push({ id, box: new THREE.Box3().setFromObject(obj) });
  }

  // The Mac's display as an in-scene terminal.
  const macPoi = pois.find((p) => p.id === "mac");
  if (macPoi && macRoot) {
    const { dirToCenter } = poiPose(macPoi);
    const towardViewer = new THREE.Vector3(dirToCenter.x, 0, dirToCenter.z).normalize();
    macScreen = createMacScreen(macPoi.anchor, macRoot, towardViewer, renderer.capabilities.getMaxAnisotropy());
    if (macScreen) scene.add(macScreen.mesh);
  }

  // GPU warm-up while the boot screen is still up, so the first visible frame doesn't hitch.
  resizeRendererToDisplaySize(renderer, camera);
  let t = performance.now();
  for (const tex of geo.textures) renderer.initTexture(tex);
  boot.line(
    `upload ${geo.textures.length} textures · ~${mb(estimateVramBytes(geo.textures))} MB vram · ${secs(performance.now() - t)}`,
  );

  t = performance.now();
  await renderer.compileAsync(scene, camera);
  const programs = (renderer.info.programs ?? []).length;
  boot.line(`compile shaders · ${programs} programs · ${secs(performance.now() - t)}`);

  if (!pois.length) {
    boot.line("no POI anchors found (need POI_*_ANCHOR in scene.glb)", "warn");
    poiLabel.textContent = "No POI anchors found";
    void boot.dismiss(400);
    appRoot.removeAttribute("data-booting");
    requestRenderIfNotRequested(render);
    return;
  }

  // Land on the Mac unless the URL asks for something else. The intro is
  // "you were inside the Mac": start close on its dark screen, then pull back.
  const fromHash = (getHashParam("poi") || "").toLowerCase();
  if (!fromHash) setHashParam("poi", pois.some((p) => p.id === "mac") ? "mac" : pois[0]!.id, "replace");
  const targetId = (getHashParam("poi") || "").toLowerCase();
  const targetIdx = Math.max(0, pois.findIndex((p) => p.id === targetId));
  const targetPoi = pois[targetIdx]!;

  const closeUp = targetPoi.id === "mac" ? screenCloseUpPose() : null;
  const overlayDeepLink = (getHashParam("overlay") || "").toLowerCase() === "macos";
  const pullBack = !!closeUp && !prefersReducedMotion() && !overlayDeepLink;
  if (closeUp && (pullBack || overlayDeepLink)) {
    // Start inside the Mac: the display fills the frame.
    camera.position.copy(closeUp.pos);
    controls.target.copy(closeUp.target);
    camera.lookAt(closeUp.target);
  }

  boot.line("ready", "good");
  track("boot_ready", { ms: Math.round(performance.now()), touch: isTouch() });
  if (overlayDeepLink) track("open_portfolio", { via: "deeplink" });
  // The screen continues the same session the boot log started.
  macScreen?.setLines(boot.history().map(toScreenLine));
  renderer.render(scene, camera);

  // Hold the final line for a beat, then hand off.
  await new Promise((r) => window.setTimeout(r, 450));

  if (pullBack) {
    // Fade the log off the "screen" first, then pull back into the room.
    void boot.dismiss(450);
    await new Promise((r) => window.setTimeout(r, 300));
    setActivePoiIndex(targetIdx, { durationMs: 1600 });
    // HUD + annotation arrive once the camera has settled, not over the close-up.
    window.setTimeout(() => appRoot.removeAttribute("data-booting"), 1500);
    // Once we're back in the room, the session prints the menu.
    window.setTimeout(showScreenMenu, 1900);
  } else {
    showScreenMenu();
    void boot.dismiss(prefersReducedMotion() ? 200 : 400);
    appRoot.removeAttribute("data-booting");
  }
  applyUrlState(); // focuses the POI (if not already) + overlay deep links

  requestRenderIfNotRequested(render);
}

function toScreenLine(l: { text: string; tone?: "muted" | "good" | "warn" }): ScreenLine {
  return { text: l.text, tone: l.tone ?? "muted" };
}

/** `portfolio --help`, as printed on the in-scene screen (mirrors the overlay home). */
function showScreenMenu() {
  if (!macScreen) return;
  const lines: ScreenLine[] = [
    ...boot.history().slice(-1).map(toScreenLine),
    { text: "haleem@genialtechie:~$ portfolio --help", tone: "accent" },
    { text: "Haleem Bello · Full Stack Developer", tone: "key" },
    { text: "Atlanta, GA · performance · accessibility", tone: "muted" },
    { text: "" },
    { text: "  [1] projects   selected work, demos, links" },
    { text: "  [2] writing    posts and notes" },
    { text: "  [3] about      bio, skills, interests" },
    { text: "  [4] contact    where to reach me" },
    { text: "" },
    { text: isTouch() ? "▸ tap to open" : "▸ click or press enter to open", tone: "good" },
  ];
  macScreen.setLines(lines);
  requestRenderIfNotRequested(render);
}

applyUrlState();

void init().catch((err) => {
  console.error(err);
  const msg = err instanceof Error ? err.message : String(err);
  boot.line(`error: ${msg.slice(0, 120)}`, "warn");
  track("boot_error", { message: msg.slice(0, 100) });
  boot.line("→ text mode", "muted");
  appRoot.removeAttribute("data-booting");
  setHashParam("overlay", "macos", "replace");
  applyUrlState();
});

window.addEventListener("resize", () => requestRenderIfNotRequested(render));

function applyUrlState() {
  // Overlay state works before the scene exists ("skip to text mode" during boot).
  const overlay = (getHashParam("overlay") || "").toLowerCase();
  if (overlay === "macos") {
    closeHelp(false);
    void openMacOverlayInternal();
  } else {
    closeMacOverlayInternal();
  }

  if (!gltfRoot || !pois.length) return;

  const poiId = (getHashParam("poi") || "").toLowerCase();
  if (poiId) {
    const idx = pois.findIndex((p) => p.id === poiId);
    if (idx >= 0) {
      if (idx !== activePoiIndex) setActivePoiIndex(idx);
    } else {
      // Invalid deep link: snap to the first POI (replace to avoid polluting history).
      setHashParam("poi", pois[0]!.id, "replace");
      if (activePoiIndex !== 0) setActivePoiIndex(0);
    }
  } else {
    // No POI specified: default to the first POI.
    setHashParam("poi", pois[0]!.id, "replace");
    if (activePoiIndex !== 0) setActivePoiIndex(0);
  }
}

window.addEventListener("hashchange", () => applyUrlState());
