import * as THREE from "three";
import { OrbitControls } from "three/examples/jsm/controls/OrbitControls.js";
import { GLTFLoader } from "three/examples/jsm/loaders/GLTFLoader.js";

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
const overlayRoot = qs<HTMLDivElement>("#overlay-root");
const annotationLayer = qs<HTMLDivElement>("#annotation-layer");
const appRoot = qs<HTMLDivElement>("#app");

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

function resizeRendererToDisplaySize(renderer: THREE.WebGLRenderer, camera: THREE.PerspectiveCamera) {
  const { clientWidth, clientHeight } = renderer.domElement;
  const dpr = Math.min(window.devicePixelRatio || 1, 2);
  const width = Math.max(1, Math.floor(clientWidth * dpr));
  const height = Math.max(1, Math.floor(clientHeight * dpr));
  const needResize = renderer.domElement.width !== width || renderer.domElement.height !== height;
  if (!needResize) return false;

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

function findPois(root: THREE.Object3D): Poi[] {
  const pois: Poi[] = [];
  root.traverse((obj: THREE.Object3D) => {
    const nm = obj.name || "";
    if (!nm.startsWith("POI_") || !nm.endsWith("_ANCHOR")) return;
    // POI_<ID>_ANCHOR
    const id = nm.slice("POI_".length, nm.length - "_ANCHOR".length).toLowerCase();
    const label = id.replaceAll("_", " ").toUpperCase();
    pois.push({ id, label, anchor: obj });
  });
  pois.sort((a, b) => a.id.localeCompare(b.id));
  return pois;
}

function isDescendantOf(obj: THREE.Object3D, ancestor: THREE.Object3D) {
  let cur: THREE.Object3D | null = obj;
  while (cur) {
    if (cur === ancestor) return true;
    cur = cur.parent;
  }
  return false;
}

let overlayUnmount: (() => void) | null = null;
let overlayOpening: Promise<void> | null = null;

async function openMacOverlayInternal() {
  if (overlayUnmount || overlayOpening) return;
  overlayRoot.hidden = false;
  controls.enabled = false;

  overlayOpening = (async () => {
    const mod = await import("./overlay/macos");
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
  requestRenderIfNotRequested(render);
}

// Three.js setup
const renderer = new THREE.WebGLRenderer({
  canvas,
  antialias: true,
  powerPreference: "high-performance",
});
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
    <div class="help-head">
      <div class="help-title" id="help-title">Tips & Credits</div>
      <button type="button" class="help-close" data-close-help="1" aria-label="Close help">Close</button>
    </div>
    <div class="help-body" id="help-desc">
      <ul class="help-list">
        <li><b>Prev/Next</b> (or Left/Right arrows) cycles points of interest.</li>
        <li><b>Drag</b> to orbit a little around the focused item.</li>
        <li><b>Double tap / double click</b> the MacBook to open the portfolio overlay.</li>
        <li><b>Esc</b> closes the overlay.</li>
      </ul>

      <details class="help-details">
        <summary>3D model credits (CC BY 4.0)</summary>
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

function maybeShowHelpOnFirstLoad() {
  try {
    const seen = localStorage.getItem("helpSeen.v1");
    if (seen) return;
  } catch {
    // ignore
  }
  openHelp();
}

function setActivePoiIndex(nextIndex: number) {
  if (!pois.length) return;
  activePoiIndex = (nextIndex + pois.length) % pois.length;
  const poi = pois[activePoiIndex]!;
  poiLabel.textContent = poi ? `POI: ${poi.label}` : "";
  setAnnotationText(annotationEl, poi ? poi.label : "");
  focusOnPoi(poi);
}

let transition:
  | {
      startT: number;
      durationMs: number;
      fromPos: THREE.Vector3;
      fromTarget: THREE.Vector3;
      toPos: THREE.Vector3;
      toTarget: THREE.Vector3;
    }
  | null = null;

const tmpV = new THREE.Vector3();
const tmpV2 = new THREE.Vector3();
const tmpBox = new THREE.Box3();

function focusOnPoi(poi: Poi) {
  if (!gltfRoot) return;

  const reduceMotion = window.matchMedia?.("(prefers-reduced-motion: reduce)")?.matches ?? false;
  const durationMs = reduceMotion ? 0 : 750;

  const target = poi.anchor.getWorldPosition(tmpV).clone();

  // Keep camera inside the room by looking from target toward the scene center.
  const center = tmpBox.setFromObject(gltfRoot).getCenter(tmpV2).clone();
  const dirToCenter = center.clone().sub(target).normalize();

  const distance = 1.7;
  const height = 0.45;
  const camPos = target
    .clone()
    .add(dirToCenter.multiplyScalar(distance))
    .add(new THREE.Vector3(0, height, 0));

  controls.enabled = false;

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

window.addEventListener("keydown", (e) => {
  if (!overlayRoot.hidden) {
    if (e.key === "Escape") {
      // Close via URL so it works even if the overlay module is still loading.
      setHashParam("overlay", null);
    }
    return;
  }

  if (helpOpen) {
    if (e.key === "Escape") closeHelp(true);
    return;
  }

  if (e.key === "ArrowLeft") prevPoi();
  if (e.key === "ArrowRight") nextPoi();
});

// Raycast interactions
const raycaster = new THREE.Raycaster();
const ndc = new THREE.Vector2();

function tryActivateMacAt(clientX: number, clientY: number) {
  if (!gltfRoot || !macRoot) return;

  const rect = canvas.getBoundingClientRect();
  ndc.x = ((clientX - rect.left) / rect.width) * 2 - 1;
  ndc.y = -(((clientY - rect.top) / rect.height) * 2 - 1);
  raycaster.setFromCamera(ndc, camera);

  const hits = raycaster.intersectObject(gltfRoot, true);
  const hitObj = hits[0]?.object;
  if (!hitObj) return;

  if (isDescendantOf(hitObj, macRoot)) {
    // Navigate via hash so back/forward works.
    setHashParams({ poi: "mac", overlay: "macos" });
  }
}

canvas.addEventListener("dblclick", (e) => {
  tryActivateMacAt(e.clientX, e.clientY);
});

// Mobile: "dblclick" doesn't reliably fire for touch, so implement a tiny double-tap detector.
let touchDown:
  | {
      id: number;
      x: number;
      y: number;
      moved: boolean;
    }
  | null = null;
let lastTap:
  | {
      t: number;
      x: number;
      y: number;
    }
  | null = null;

const TAP_MOVE_PX = 14;
const DOUBLE_TAP_MS = 360;
const DOUBLE_TAP_RADIUS_PX = 26;

canvas.addEventListener("pointerdown", (e) => {
  if (e.pointerType !== "touch") return;
  touchDown = { id: e.pointerId, x: e.clientX, y: e.clientY, moved: false };
});

canvas.addEventListener("pointermove", (e) => {
  if (!touchDown) return;
  if (e.pointerType !== "touch") return;
  if (e.pointerId !== touchDown.id) return;
  const dx = e.clientX - touchDown.x;
  const dy = e.clientY - touchDown.y;
  if (dx * dx + dy * dy > TAP_MOVE_PX * TAP_MOVE_PX) touchDown.moved = true;
});

canvas.addEventListener("pointerup", (e) => {
  if (e.pointerType !== "touch") return;
  if (touchDown && e.pointerId === touchDown.id && touchDown.moved) {
    touchDown = null;
    return;
  }
  touchDown = null;

  const now = performance.now();
  if (!lastTap) {
    lastTap = { t: now, x: e.clientX, y: e.clientY };
    return;
  }

  const dt = now - lastTap.t;
  const dx = e.clientX - lastTap.x;
  const dy = e.clientY - lastTap.y;
  const within = dx * dx + dy * dy <= DOUBLE_TAP_RADIUS_PX * DOUBLE_TAP_RADIUS_PX;

  if (dt <= DOUBLE_TAP_MS && within) {
    lastTap = null;
    tryActivateMacAt(e.clientX, e.clientY);
    return;
  }

  lastTap = { t: now, x: e.clientX, y: e.clientY };
});

canvas.addEventListener("pointercancel", (e) => {
  if (e.pointerType !== "touch") return;
  touchDown = null;
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
    controls.update();

    if (t >= 1) {
      transition = null;
      controls.enabled = true;
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

async function init() {
  const gltf = await loader.loadAsync("/scene.glb");
  gltfRoot = gltf.scene;

  // Normalize units: the room appears authored in inches; scale scene to meters.
  gltfRoot.scale.setScalar(0.0254);
  scene.add(gltfRoot);

  // Aim key/fill at the scene center so relayouts of the GLB don't break the look.
  const center = tmpBox.setFromObject(gltfRoot).getCenter(tmpV2);
  key.target.position.copy(center);
  fill.target.position.copy(center);

  // POIs
  pois = findPois(gltfRoot);
  for (const p of pois) p.anchor.visible = false;

  // Mac root (used for double-click hit testing)
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

  if (!pois.length) {
    poiLabel.textContent = "No POI anchors found (need POI_*_ANCHOR groups in scene.glb)";
    requestRenderIfNotRequested(render);
    return;
  }

  // Initial navigation: if URL has a POI, respect it. Otherwise default to the first POI
  // but avoid creating a history entry on initial load.
  const fromHash = (getHashParam("poi") || "").toLowerCase();
  if (!fromHash) {
    const first = pois[0]!;
    setHashParam("poi", first.id, "replace");
  }

  applyUrlState();

  requestRenderIfNotRequested(render);
  maybeShowHelpOnFirstLoad();
}

void init().catch((err) => {
  console.error(err);
  poiLabel.textContent = "Failed to load scene.glb (check console)";
  requestRenderIfNotRequested(render);
});

window.addEventListener("resize", () => requestRenderIfNotRequested(render));

function applyUrlState() {
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

  const overlay = (getHashParam("overlay") || "").toLowerCase();
  const wantOverlay = overlay === "macos";
  if (wantOverlay) {
    closeHelp(false);
    void openMacOverlayInternal();
  } else {
    closeMacOverlayInternal();
  }
}

window.addEventListener("hashchange", () => applyUrlState());
