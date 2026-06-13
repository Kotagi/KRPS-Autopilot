import * as THREE from "three";

function makeCanvasTexture(
  draw: (ctx: CanvasRenderingContext2D, size: number) => void,
  size = 64,
): THREE.CanvasTexture {
  const canvas = document.createElement("canvas");
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext("2d");
  if (!ctx) {
    return new THREE.CanvasTexture(canvas);
  }
  draw(ctx, size);
  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  return texture;
}

let sunTexture: THREE.CanvasTexture | null = null;
let kerbinTexture: THREE.CanvasTexture | null = null;
let planetBodyDotTexture: THREE.CanvasTexture | null = null;

export function getSunTexture(): THREE.CanvasTexture {
  if (!sunTexture) {
    sunTexture = makeCanvasTexture((ctx, size) => {
      const g = ctx.createRadialGradient(size / 2, size / 2, 0, size / 2, size / 2, size / 2);
      g.addColorStop(0, "#fff4c2");
      g.addColorStop(0.5, "#ffd166");
      g.addColorStop(1, "#e67e22");
      ctx.fillStyle = g;
      ctx.fillRect(0, 0, size, size);
    });
  }
  return sunTexture;
}

/** White circle alpha mask for fixed-screen planet map dots (PointsMaterial map). */
export function getPlanetBodyDotTexture(): THREE.CanvasTexture {
  if (!planetBodyDotTexture) {
    planetBodyDotTexture = makeCanvasTexture((ctx, size) => {
      const r = size / 2;
      ctx.clearRect(0, 0, size, size);
      ctx.beginPath();
      ctx.arc(r, r, r - 0.5, 0, Math.PI * 2);
      ctx.fillStyle = "#ffffff";
      ctx.fill();
    }, 64);
  }
  return planetBodyDotTexture;
}

export function getKerbinTexture(): THREE.CanvasTexture {
  if (!kerbinTexture) {
    kerbinTexture = makeCanvasTexture((ctx, size) => {
      ctx.fillStyle = "#1a4d6d";
      ctx.fillRect(0, 0, size, size);
      ctx.fillStyle = "#4ecdc4";
      for (let i = 0; i < 8; i++) {
        const x = (i * 17) % size;
        const y = (i * 23) % size;
        ctx.beginPath();
        ctx.ellipse(x, y, 12, 8, 0, 0, Math.PI * 2);
        ctx.fill();
      }
    });
  }
  return kerbinTexture;
}
