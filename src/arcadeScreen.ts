import * as THREE from "three";

// The cabinet's screen shows a Hoopzy attract screen instead of the original
// Final Fight art, with the visitor's best score once they've played. It's a
// canvas texture, redrawn only when the score changes.

const W = 1024;
const H = 726; // the physical screen is about 1.41:1
const BEST_KEY = "hoopzy.best";

function readBest() {
  try {
    const n = Number(localStorage.getItem(BEST_KEY));
    return Number.isFinite(n) && n > 0 ? Math.floor(n) : 0;
  } catch {
    return 0;
  }
}

function draw(ctx: CanvasRenderingContext2D, best: number, touch: boolean) {
  const mono = 'ui-monospace, SFMono-Regular, Menlo, Consolas, "Liberation Mono", monospace';
  const display = 'Anton, Impact, "Arial Black", sans-serif';

  // Night court.
  const bg = ctx.createLinearGradient(0, 0, 0, H);
  bg.addColorStop(0, "#0b1420");
  bg.addColorStop(0.62, "#10202c");
  bg.addColorStop(1, "#1b120c");
  ctx.fillStyle = bg;
  ctx.fillRect(0, 0, W, H);

  // Floor glow under the hoop.
  const floor = ctx.createRadialGradient(W / 2, H * 0.9, 20, W / 2, H * 0.9, W * 0.55);
  floor.addColorStop(0, "rgba(255,141,48,0.28)");
  floor.addColorStop(1, "rgba(255,141,48,0)");
  ctx.fillStyle = floor;
  ctx.fillRect(0, 0, W, H);

  ctx.textAlign = "center";
  ctx.textBaseline = "middle";

  // Score line, like the top of an arcade screen.
  ctx.font = `700 34px ${mono}`;
  ctx.fillStyle = "#ffd24a";
  ctx.fillText(`HI-SCORE ${String(best).padStart(3, "0")}`, W / 2, 64);

  // Backboard, rim and ball.
  const cx = W / 2;
  ctx.fillStyle = "rgba(216,208,196,0.92)";
  ctx.fillRect(cx - 96, 132, 192, 116);
  ctx.strokeStyle = "#f2684d";
  ctx.lineWidth = 6;
  ctx.strokeRect(cx - 38, 160, 76, 56);
  ctx.strokeStyle = "#ff8d30";
  ctx.lineWidth = 10;
  ctx.beginPath();
  ctx.ellipse(cx, 256, 70, 14, 0, 0, Math.PI * 2);
  ctx.stroke();
  ctx.strokeStyle = "rgba(223,232,236,0.6)";
  ctx.lineWidth = 3;
  for (let i = -3; i <= 3; i++) {
    ctx.beginPath();
    ctx.moveTo(cx + i * 20, 262);
    ctx.lineTo(cx + i * 12, 318);
    ctx.stroke();
  }
  const ball = ctx.createRadialGradient(cx + 120, 300, 6, cx + 132, 312, 44);
  ball.addColorStop(0, "#e88a3c");
  ball.addColorStop(1, "#8e2e11");
  ctx.fillStyle = ball;
  ctx.beginPath();
  ctx.arc(cx + 132, 312, 40, 0, Math.PI * 2);
  ctx.fill();

  // Neon wordmark.
  ctx.font = `400 150px ${display}`;
  ctx.shadowColor = "rgba(255,141,48,0.9)";
  ctx.shadowBlur = 28;
  ctx.fillStyle = "#fff4e8";
  ctx.fillText("HOOPZY", W / 2, 452);
  ctx.shadowBlur = 0;

  // Call to action.
  ctx.font = `700 40px ${mono}`;
  ctx.fillStyle = "#2ee6d6";
  ctx.fillText("INSERT COIN", W / 2, 572);
  ctx.font = `400 26px ${mono}`;
  ctx.fillStyle = "rgba(233,236,242,0.7)";
  ctx.fillText(touch ? "TAP TO PLAY" : "CLICK OR PRESS ENTER", W / 2, 626);

  // Scanlines.
  ctx.fillStyle = "rgba(0,0,0,0.18)";
  for (let y = 0; y < H; y += 4) ctx.fillRect(0, y, W, 2);
}

export function createArcadeScreen(mesh: THREE.Mesh, maxAnisotropy: number, touch: boolean) {
  const canvas = document.createElement("canvas");
  canvas.width = W;
  canvas.height = H;
  const ctx = canvas.getContext("2d");
  if (!ctx) return null;

  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  texture.anisotropy = Math.min(8, maxAnisotropy);

  // A screen emits light: unlit, so it reads the same from every angle.
  const material = new THREE.MeshBasicMaterial({ map: texture, toneMapped: false });
  const old = mesh.material;
  mesh.material = material;
  for (const m of Array.isArray(old) ? old : [old]) {
    (m as THREE.MeshStandardMaterial).map?.dispose();
    m.dispose();
  }

  let drawnBest = -1;
  function refresh() {
    const best = readBest();
    if (best === drawnBest) return false;
    drawnBest = best;
    draw(ctx!, best, touch);
    texture.needsUpdate = true;
    return true;
  }
  refresh();

  return { material, refresh };
}
