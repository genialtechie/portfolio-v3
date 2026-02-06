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
const poiLabel = qs<HTMLSpanElement>("#poi-label");
const overlayRoot = qs<HTMLDivElement>("#overlay-root");
const annotationLayer = qs<HTMLDivElement>("#annotation-layer");

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
let activePoiIndex = 0;

const annotationEl = createAnnotation();
setAnnotationText(annotationEl, "");

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

  if (e.key === "ArrowLeft") prevPoi();
  if (e.key === "ArrowRight") nextPoi();
});

// Raycast interactions
const raycaster = new THREE.Raycaster();
const ndc = new THREE.Vector2();

canvas.addEventListener("dblclick", (e) => {
  if (!gltfRoot || !macRoot) return;

  const rect = canvas.getBoundingClientRect();
  ndc.x = ((e.clientX - rect.left) / rect.width) * 2 - 1;
  ndc.y = -(((e.clientY - rect.top) / rect.height) * 2 - 1);
  raycaster.setFromCamera(ndc, camera);

  const hits = raycaster.intersectObject(gltfRoot, true);
  const hitObj = hits[0]?.object;
  if (!hitObj) return;

  if (isDescendantOf(hitObj, macRoot)) {
    // Navigate via hash so back/forward works.
    setHashParams({ poi: "mac", overlay: "macos" });
  }
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
  if (pois.length) {
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
    if (idx >= 0 && idx !== activePoiIndex) setActivePoiIndex(idx);
  }

  const overlay = (getHashParam("overlay") || "").toLowerCase();
  const wantOverlay = overlay === "macos";
  if (wantOverlay) void openMacOverlayInternal();
  else closeMacOverlayInternal();
}

window.addEventListener("hashchange", () => applyUrlState());
