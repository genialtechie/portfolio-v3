import * as THREE from "three";

// The MacBook's display, rendered as a terminal in the scene.
//
// The laptop model bakes its screen into one mesh/material, so instead of
// swapping a texture we float a thin plane just in front of the lid. The lid
// and bezel are black, so the plane only needs to sit inside them.
//
// Text is drawn to a canvas once per content change (render-on-demand: no
// per-frame work, no blinking cursor).

export type ScreenLine = { text: string; tone?: "plain" | "muted" | "accent" | "good" | "warn" | "key" };

// Measured against scene.glb (world units, after the 0.0254 scene scale):
// display centre relative to POI_MAC_ANCHOR, and a safe display size inside the bezel.
const CENTER_FROM_ANCHOR = new THREE.Vector3(0.037, -0.019, 0);
const DISPLAY_W = 0.58;
const DISPLAY_H = 0.3625; // 16:10
const LIFT = 0.0015; // metres in front of the lid, avoids z-fighting

const CANVAS_W = 1280;
const CANVAS_H = 800;
const PAD_X = 64;
const PAD_Y = 56;
const FONT_PX = 40;
const LINE_H = 58;
const FONT = `${FONT_PX}px ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, "Liberation Mono", monospace`;

const COLORS: Record<NonNullable<ScreenLine["tone"]>, string> = {
  plain: "rgba(233, 236, 242, 0.92)",
  muted: "rgba(233, 236, 242, 0.55)",
  accent: "#6ee7ff",
  good: "#8efc8e",
  warn: "#ffd166",
  key: "#ffffff",
};

export type MacScreen = {
  mesh: THREE.Mesh;
  /** World-space centre and outward normal of the display (for camera framing). */
  center: THREE.Vector3;
  normal: THREE.Vector3;
  setLines(lines: ScreenLine[]): void;
  dispose(): void;
};

/**
 * @param anchor POI_MAC_ANCHOR (world position sits just in front of the display)
 * @param lid    object to raycast for the lid surface/normal (the MacBook root)
 * @param towardViewer approximate direction from the Mac toward the viewer
 */
export function createMacScreen(
  anchor: THREE.Object3D,
  lid: THREE.Object3D,
  towardViewer: THREE.Vector3,
  maxAnisotropy: number,
): MacScreen | null {
  const anchorPos = anchor.getWorldPosition(new THREE.Vector3());

  // Find the lid surface + normal by casting from the viewer side toward the anchor.
  const origin = anchorPos.clone().addScaledVector(towardViewer, 1);
  const rc = new THREE.Raycaster(origin, anchorPos.clone().sub(origin).normalize());
  const hit = rc.intersectObject(lid, true)[0];
  if (!hit?.face) return null;

  const normal = hit.face.normal.clone().transformDirection(hit.object.matrixWorld).normalize();
  if (normal.dot(towardViewer) < 0) normal.negate();

  const center = anchorPos.clone().add(CENTER_FROM_ANCHOR);
  // Project the centre onto the lid plane, then lift it slightly.
  const toPlane = hit.point.clone().sub(center).dot(normal);
  center.addScaledVector(normal, toPlane + LIFT);

  const canvas = document.createElement("canvas");
  canvas.width = CANVAS_W;
  canvas.height = CANVAS_H;
  const ctx = canvas.getContext("2d")!;

  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace; // it's a colour image
  texture.anisotropy = Math.min(8, maxAnisotropy); // read at an angle while orbiting
  texture.generateMipmaps = true;
  texture.minFilter = THREE.LinearMipmapLinearFilter;

  const material = new THREE.MeshBasicMaterial({ map: texture, toneMapped: false });
  const geometry = new THREE.PlaneGeometry(DISPLAY_W, DISPLAY_H);
  const mesh = new THREE.Mesh(geometry, material);
  mesh.name = "MAC_SCREEN";
  mesh.position.copy(center);
  mesh.lookAt(center.clone().add(normal));
  // Not a hit target for scene raycasts (the Mac's bounding box handles clicks).
  mesh.raycast = () => {};

  const draw = (lines: ScreenLine[]) => {
    ctx.fillStyle = "#000";
    ctx.fillRect(0, 0, CANVAS_W, CANVAS_H);
    ctx.font = FONT;
    ctx.textBaseline = "top";

    // Keep the newest lines, like a real terminal scrolling.
    const maxLines = Math.floor((CANVAS_H - PAD_Y * 2) / LINE_H);
    const visible = lines.slice(-maxLines);
    const maxW = CANVAS_W - PAD_X * 2;

    visible.forEach((line, i) => {
      ctx.fillStyle = COLORS[line.tone ?? "plain"];
      let text = line.text;
      while (text.length > 1 && ctx.measureText(text).width > maxW) text = text.slice(0, -2) + "…";
      ctx.fillText(text, PAD_X, PAD_Y + i * LINE_H);
    });
    texture.needsUpdate = true;
  };

  draw([]);

  return {
    mesh,
    center,
    normal,
    setLines: draw,
    dispose() {
      geometry.dispose();
      material.dispose();
      texture.dispose();
      mesh.removeFromParent();
    },
  };
}
