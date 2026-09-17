/**
 * ORCA — the sunken instruments.
 *
 * The workspace's panels, built as real objects: rounded, bevelled slabs
 * with thickness, a dark glass edge and a screen face that carries the
 * panel's art. They rest tilted on the seabed in the deep, dark; a sonar
 * ping wakes them (the screens light, they lift), and they rise into a wall
 * that faces the lens and exactly fills its frustum. The page then fades in
 * over the wall.
 *
 * `workspaceLayout` mirrors the real shell's CSS in CSS pixels — header
 * height, chat rail width, the chat's inner pieces, the map furniture — so
 * every slab lands over the element that is about to replace it.
 */

import type { BufferGeometry, Group, Material, Mesh, MeshStandardMaterial, Texture } from "three";
import { CAUSTIC_INJECT } from "./shaders";
import type { SceneRegistry } from "./world";

type Three = typeof import("three");

export interface Rect { x: number; y: number; w: number; h: number }

const INK = "#17232d";
const SLATE = "#64727d";
const LINE = "#d9e3e8";
const NAVY = "#124e78";
const BLUE = "#2f6f95";
const BG = "#f5f8fa";
const MINT = "#a7e3d4";

export type InstrumentKey =
  | "header" | "tabs" | "chat" | "chatHeader" | "greeting" | "card" | "composer"
  | "map" | "layers" | "actions" | "legend" | "sonar" | "hint";

/** Panel rectangles in CSS pixels, in paint order (surfaces first). */
export function workspaceLayout(width: number, height: number): { key: InstrumentKey; rect: Rect }[] {
  const desktop = width >= 1024;
  const headerH = desktop ? 54 : 50;
  const out: { key: InstrumentKey; rect: Rect }[] = [{ key: "header", rect: { x: 0, y: 0, w: width, h: headerH } }];
  let chatX = 0, chatY = headerH, chatW = width, chatH = height - headerH;
  if (!desktop) {
    const tabsH = 58;
    out.push({ key: "tabs", rect: { x: 0, y: headerH, w: width, h: tabsH } });
    chatY += tabsH;
    chatH -= tabsH;
  } else {
    chatW = width >= 1280 ? 430 : 400;
  }
  out.push({ key: "chat", rect: { x: chatX, y: chatY, w: chatW, h: chatH } });
  out.push({ key: "chatHeader", rect: { x: chatX, y: chatY, w: chatW, h: 42 } });
  out.push({ key: "greeting", rect: { x: chatX + 18, y: chatY + 42 + 26, w: chatW - 36, h: 58 } });
  const composerH = 84;
  const cardY = chatY + 42 + 26 + 58 + 20;
  const cardH = Math.max(120, Math.min(236, chatY + chatH - composerH - 24 - cardY));
  out.push({ key: "card", rect: { x: chatX + 18, y: cardY, w: chatW - 36, h: cardH } });
  out.push({ key: "composer", rect: { x: chatX, y: chatY + chatH - composerH, w: chatW, h: composerH } });
  if (!desktop) return out;
  const mapX = chatW, mapY = headerH, mapW = width - chatW, mapH = height - headerH;
  out.push({ key: "map", rect: { x: mapX, y: mapY, w: mapW, h: mapH } });
  out.push({ key: "layers", rect: { x: mapX + 12, y: mapY + 12, w: 152, h: 122 } });
  out.push({ key: "actions", rect: { x: mapX + mapW - 12 - 136, y: mapY + 12, w: 136, h: 34 } });
  out.push({ key: "legend", rect: { x: mapX + 12, y: mapY + mapH - 12 - 88, w: 170, h: 88 } });
  out.push({ key: "sonar", rect: { x: mapX + mapW - 12 - 72, y: mapY + mapH / 2 - 36, w: 72, h: 72 } });
  out.push({ key: "hint", rect: { x: mapX + mapW / 2 - 116, y: mapY + 16, w: 232, h: 34 } });
  return out;
}

/* ── Screen art ────────────────────────────────────────────────────────── */

function rounded(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, r: number) {
  const radius = Math.min(r, w / 2, h / 2);
  ctx.beginPath();
  ctx.moveTo(x + radius, y);
  ctx.arcTo(x + w, y, x + w, y + h, radius);
  ctx.arcTo(x + w, y + h, x, y + h, radius);
  ctx.arcTo(x, y + h, x, y, radius);
  ctx.arcTo(x, y, x + w, y, radius);
  ctx.closePath();
}
function fillRounded(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, r: number, fill: string, stroke?: string) {
  rounded(ctx, x, y, w, h, r);
  ctx.fillStyle = fill;
  ctx.fill();
  if (stroke) { ctx.strokeStyle = stroke; ctx.lineWidth = 1; ctx.stroke(); }
}
function label(ctx: CanvasRenderingContext2D, text: string, x: number, y: number, size: number, color: string, weight = "500", spacing = 0) {
  ctx.fillStyle = color;
  ctx.font = `${weight} ${size}px Inter, ui-sans-serif, system-ui, -apple-system, "Segoe UI", sans-serif`;
  ctx.textBaseline = "middle";
  if (!spacing) { ctx.fillText(text, x, y); return; }
  let cursor = x;
  for (const ch of text) { ctx.fillText(ch, cursor, y); cursor += ctx.measureText(ch).width + spacing; }
}
function dot(ctx: CanvasRenderingContext2D, x: number, y: number, r: number, color: string) {
  ctx.fillStyle = color; ctx.beginPath(); ctx.arc(x, y, r, 0, Math.PI * 2); ctx.fill();
}
function bars(ctx: CanvasRenderingContext2D, x: number, y: number, widths: number[], h: number, gap: number, color: string) {
  ctx.fillStyle = color;
  widths.forEach((w, i) => { rounded(ctx, x, y + i * (h + gap), w, h, h / 2); ctx.fill(); });
}

const PAINT: Record<InstrumentKey, (ctx: CanvasRenderingContext2D, w: number, h: number) => void> = {
  header(ctx, w, h) {
    ctx.fillStyle = "#ffffff"; ctx.fillRect(0, 0, w, h);
    ctx.fillStyle = LINE; ctx.fillRect(0, h - 1, w, 1);
    const cy = h / 2;
    fillRounded(ctx, 14, cy - 11, 22, 22, 6, NAVY); dot(ctx, 25, cy, 4.5, MINT);
    label(ctx, "ORCA", 44, cy - 1, 15, INK, "700");
    label(ctx, "Marine Ecosystem Reasoning", 92, cy, 9.5, SLATE);
    fillRounded(ctx, 262, cy - 9, 74, 18, 9, "#fff2e8", "#f0d6bd"); dot(ctx, 272, cy, 3, "#b45309");
    label(ctx, "DEMO DATA", 279, cy, 7.5, "#b45309", "700", 0.4);
    let right = w - 14;
    for (const width of [34, 60, 92]) {
      right -= width;
      fillRounded(ctx, right, cy - 13, width, 26, 6, "#ffffff", LINE);
      bars(ctx, right + 9, cy - 2, [width - 22], 4, 0, SLATE);
      right -= 8;
    }
  },
  tabs(ctx, w, h) {
    ctx.fillStyle = "#ffffff"; ctx.fillRect(0, 0, w, h);
    ctx.fillStyle = LINE; ctx.fillRect(0, h - 1, w, 1);
    fillRounded(ctx, 12, 8, w - 24, 34, 10, BG);
    fillRounded(ctx, 16, 12, (w - 32) / 2, 26, 8, "#ffffff", LINE);
    label(ctx, "Chat", (w - 32) / 4 + 4, 25, 11, NAVY, "600");
    label(ctx, "Chart", (w - 32) * 0.75 + 12, 25, 11, SLATE, "600");
  },
  chat(ctx, w, h) {
    ctx.fillStyle = BG; ctx.fillRect(0, 0, w, h);
    ctx.fillStyle = LINE; ctx.fillRect(w - 1, 0, 1, h);
    // Deep-water bubbles rising behind the conversation.
    for (let i = 0; i < 9; i++) {
      dot(ctx, (i * 0.11 + 0.06) * w, h * (0.25 + ((i * 0.37) % 0.6)), 3 + (i % 3) * 1.5, "rgba(47,111,149,0.14)");
    }
  },
  chatHeader(ctx, w, h) {
    ctx.fillStyle = "rgba(255,255,255,0.92)"; ctx.fillRect(0, 0, w, h);
    ctx.fillStyle = LINE; ctx.fillRect(0, h - 1, w, 1);
    label(ctx, "CONVERSATION", 16, h / 2, 9.5, SLATE, "600", 0.9);
    label(ctx, "New session", w - 88, h / 2, 9.5, SLATE);
  },
  greeting(ctx, w, h) {
    fillRounded(ctx, 0, 0, 26, 26, 7, NAVY); dot(ctx, 13, 13, 5, MINT);
    label(ctx, "Good morning.", 36, 10, 12.5, INK, "600");
    bars(ctx, 36, 24, [Math.min(w - 40, 190), Math.min(w - 40, 150)], 5, 6, "#9fb0bb");
  },
  card(ctx, w, h) {
    fillRounded(ctx, 0.5, 0.5, w - 1, h - 1, 10, "#ffffff", LINE);
    label(ctx, "Ask about the water ahead", 14, 22, 11.5, INK, "600");
    bars(ctx, 14, 40, [Math.min(w - 40, 220)], 5, 0, "#9fb0bb");
    let px = 14, py = 58;
    for (const pw of [62, 78, 54, 70, 66]) {
      if (px + pw > w - 14) { px = 14; py += 26; }
      if (py + 21 > h - 44) break;
      fillRounded(ctx, px, py, pw, 21, 10.5, "#ffffff", LINE);
      dot(ctx, px + 11, py + 10.5, 3.2, BLUE);
      bars(ctx, px + 19, py + 9, [pw - 28], 4, 0, "#8fa3ae");
      px += pw + 7;
    }
    const ry = h - 44;
    fillRounded(ctx, 14, ry, w - 28, 30, 6, "#e7f0f5", LINE);
    ctx.save(); rounded(ctx, 14, ry, w - 28, 30, 6); ctx.clip();
    const g = ctx.createLinearGradient(0, ry, 0, ry + 30); g.addColorStop(0, "#bcd9e8"); g.addColorStop(1, "#7fa9c4");
    ctx.fillStyle = g; ctx.beginPath(); ctx.moveTo(14, ry + 30);
    for (let x = 0; x <= w; x += 6) ctx.lineTo(14 + x, ry + 16 + Math.sin(x / 22) * 5 + Math.sin(x / 9) * 2);
    ctx.lineTo(w, ry + 30); ctx.closePath(); ctx.fill(); ctx.restore();
  },
  composer(ctx, w, h) {
    ctx.fillStyle = "#ffffff"; ctx.fillRect(0, 0, w, h);
    ctx.fillStyle = LINE; ctx.fillRect(0, 0, w, 1);
    fillRounded(ctx, 14, 14, w - 28, 42, 10, BG, LINE);
    bars(ctx, 28, 35, [Math.min(w - 120, 170)], 5, 0, "#a6b6c0");
    fillRounded(ctx, w - 58, 22, 30, 26, 7, NAVY);
    ctx.fillStyle = "#ffffff"; ctx.beginPath(); ctx.moveTo(w - 48, 29); ctx.lineTo(w - 38, 35); ctx.lineTo(w - 48, 41); ctx.closePath(); ctx.fill();
    label(ctx, "Ask in your language — multilingual", 16, h - 12, 8.5, SLATE);
  },
  map(ctx, w, h) {
    const sea = ctx.createLinearGradient(0, 0, 0, h); sea.addColorStop(0, "#e6f0f6"); sea.addColorStop(1, "#dce9f2");
    ctx.fillStyle = sea; ctx.fillRect(0, 0, w, h);
    ctx.strokeStyle = "rgba(47,111,149,0.12)"; ctx.lineWidth = 1;
    const step = Math.max(64, Math.round(w / 12));
    for (let x = step; x < w; x += step) { ctx.beginPath(); ctx.moveTo(x, 0); ctx.lineTo(x, h); ctx.stroke(); }
    for (let y = step; y < h; y += step) { ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(w, y); ctx.stroke(); }
    ctx.strokeStyle = "rgba(47,111,149,0.16)";
    for (let ring = 0; ring < 4; ring++) {
      ctx.beginPath();
      for (let a = 0; a <= 64; a++) {
        const t = (a / 64) * Math.PI * 2;
        const r = (0.14 + ring * 0.09) * Math.min(w, h) * (1 + Math.sin(t * 3 + ring) * 0.12 + Math.sin(t * 5 - ring) * 0.06);
        const x = w * 0.62 + Math.cos(t) * r * 1.25, y = h * 0.52 + Math.sin(t) * r;
        if (a === 0) ctx.moveTo(x, y); else ctx.lineTo(x, y);
      }
      ctx.closePath(); ctx.stroke();
    }
    ctx.fillStyle = "#e9e5d8"; ctx.strokeStyle = "#c9c3b0"; ctx.lineWidth = 1.4;
    ctx.beginPath(); ctx.moveTo(0, 0);
    for (let y = 0; y <= h; y += 14) ctx.lineTo(w * 0.13 + Math.sin(y / 78) * w * 0.045 + Math.sin(y / 31) * w * 0.016, y);
    ctx.lineTo(0, h); ctx.closePath(); ctx.fill(); ctx.stroke();
    ctx.fillStyle = "rgba(46,125,91,0.15)"; ctx.strokeStyle = "rgba(46,125,91,0.55)"; ctx.setLineDash([6, 5]);
    ctx.beginPath(); ctx.ellipse(w * 0.58, h * 0.38, w * 0.13, h * 0.12, 0.4, 0, Math.PI * 2); ctx.fill(); ctx.stroke(); ctx.setLineDash([]);
    ctx.strokeStyle = NAVY; ctx.lineWidth = 2.2; ctx.setLineDash([9, 6]);
    ctx.beginPath(); ctx.moveTo(w * 0.2, h * 0.74); ctx.bezierCurveTo(w * 0.36, h * 0.62, w * 0.42, h * 0.42, w * 0.61, h * 0.36); ctx.stroke(); ctx.setLineDash([]);
    for (const [mx, my, c] of [[0.61, 0.36, "#2e7d5b"], [0.44, 0.58, "#b45309"], [0.74, 0.62, BLUE], [0.53, 0.24, "#b42318"]] as const) {
      dot(ctx, w * mx, h * my, 9, "rgba(255,255,255,0.9)"); dot(ctx, w * mx, h * my, 5.5, c);
    }
    ctx.fillStyle = NAVY; ctx.save(); ctx.translate(w * 0.2, h * 0.74); ctx.rotate(-0.6);
    ctx.beginPath(); ctx.moveTo(0, -9); ctx.lineTo(6, 8); ctx.lineTo(0, 4); ctx.lineTo(-6, 8); ctx.closePath(); ctx.fill(); ctx.restore();
    ctx.fillStyle = "rgba(255,255,255,0.75)"; ctx.fillRect(w - 168, h - 18, 168, 18);
    label(ctx, "Esri · Demo data", w - 158, h - 9, 8.5, SLATE);
  },
  layers(ctx, w, h) {
    fillRounded(ctx, 0.5, 0.5, w - 1, h - 1, 10, "rgba(255,255,255,0.97)", LINE);
    label(ctx, "LAYERS", 12, 16, 8.5, SLATE, "700", 0.8);
    ["Vessel", "Fishing zones", "Hazards", "Route"].forEach((row, i) => {
      const y = 34 + i * 20;
      fillRounded(ctx, 12, y - 5, 18, 10, 5, i < 3 ? BLUE : "#cfdae1");
      dot(ctx, i < 3 ? 25 : 17, y, 3.6, "#ffffff");
      label(ctx, row, 38, y, 9.5, i < 3 ? INK : SLATE);
    });
  },
  actions(ctx, w, h) {
    fillRounded(ctx, 0.5, 0.5, w - 1, h - 1, h / 2, "rgba(255,255,255,0.97)", LINE);
    for (let i = 0; i < 3; i++) {
      const cx = (w / 3) * (i + 0.5);
      ctx.strokeStyle = BLUE; ctx.lineWidth = 1.6; ctx.beginPath();
      if (i === 0) ctx.arc(cx, h / 2, 5.5, 0, Math.PI * 2);
      else if (i === 1) { ctx.moveTo(cx - 5, h / 2 - 5); ctx.lineTo(cx + 5, h / 2 + 5); ctx.moveTo(cx + 5, h / 2 - 5); ctx.lineTo(cx - 5, h / 2 + 5); }
      else ctx.rect(cx - 5, h / 2 - 5, 10, 10);
      ctx.stroke();
    }
  },
  legend(ctx, w, h) {
    fillRounded(ctx, 0.5, 0.5, w - 1, h - 1, 10, "rgba(255,255,255,0.97)", LINE);
    label(ctx, "LEGEND", 12, 16, 8.5, SLATE, "700", 0.8);
    ([["Safe", "#2e7d5b"], ["Caution", "#b45309"], ["Avoid", "#b42318"]] as const).forEach(([text, c], i) => {
      fillRounded(ctx, 12, 36 + i * 18 - 5, 14, 10, 3, c); label(ctx, text, 33, 36 + i * 18, 9.5, INK);
    });
  },
  sonar(ctx, w, h) {
    const r = Math.min(w, h) / 2;
    dot(ctx, w / 2, h / 2, r - 1, "#0b2a3a");
    ctx.strokeStyle = "rgba(167,227,212,0.55)"; ctx.lineWidth = 1;
    for (let ring = 1; ring <= 3; ring++) { ctx.beginPath(); ctx.arc(w / 2, h / 2, (r - 4) * ring / 3, 0, Math.PI * 2); ctx.stroke(); }
    ctx.beginPath(); ctx.moveTo(w / 2, h / 2 - r); ctx.lineTo(w / 2, h / 2 + r); ctx.moveTo(w / 2 - r, h / 2); ctx.lineTo(w / 2 + r, h / 2); ctx.stroke();
    const sweep = ctx.createConicGradient?.(0, w / 2, h / 2);
    if (sweep) {
      sweep.addColorStop(0, "rgba(167,227,212,0.55)"); sweep.addColorStop(0.25, "rgba(167,227,212,0)"); sweep.addColorStop(1, "rgba(167,227,212,0)");
      ctx.fillStyle = sweep; ctx.beginPath(); ctx.arc(w / 2, h / 2, r - 2, 0, Math.PI * 2); ctx.fill();
    }
    dot(ctx, w * 0.66, h * 0.38, 2.6, MINT);
  },
  hint(ctx, w, h) {
    fillRounded(ctx, 0.5, 0.5, w - 1, h - 1, h / 2, "rgba(255,255,255,0.96)", LINE);
    dot(ctx, 18, h / 2, 3.4, BLUE);
    label(ctx, "Ask a question to chart the water", 30, h / 2, 10, "#2c3a45");
  },
};

function paintScreen(THREE: Three, key: InstrumentKey, rect: Rect, quality: number): Texture {
  const canvas = document.createElement("canvas");
  const scale = Math.min(quality, 1536 / Math.max(rect.w, rect.h, 1));
  canvas.width = Math.max(32, Math.round(rect.w * scale));
  canvas.height = Math.max(32, Math.round(rect.h * scale));
  const ctx = canvas.getContext("2d");
  if (ctx) { ctx.scale(scale, scale); ctx.clearRect(0, 0, rect.w, rect.h); PAINT[key](ctx, rect.w, rect.h); }
  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  texture.anisotropy = 8;
  texture.needsUpdate = true;
  return texture;
}

/* ── Objects ───────────────────────────────────────────────────────────── */

/** A rounded slab of width w, height h, with the screen UV-mapped 0..1 across the front. */
function slabGeometry(THREE: Three, w: number, h: number, depth: number, radius: number) {
  const r = Math.min(radius, w / 2, h / 2);
  const shape = new THREE.Shape();
  const x = -w / 2, y = -h / 2;
  shape.moveTo(x + r, y);
  shape.lineTo(x + w - r, y); shape.quadraticCurveTo(x + w, y, x + w, y + r);
  shape.lineTo(x + w, y + h - r); shape.quadraticCurveTo(x + w, y + h, x + w - r, y + h);
  shape.lineTo(x + r, y + h); shape.quadraticCurveTo(x, y + h, x, y + h - r);
  shape.lineTo(x, y + r); shape.quadraticCurveTo(x, y, x + r, y);
  const bevel = Math.min(depth * 0.35, r * 0.6);
  const geometry = new THREE.ExtrudeGeometry(shape, {
    depth, bevelEnabled: true, bevelSize: bevel, bevelThickness: bevel, bevelSegments: 2, curveSegments: 6,
    UVGenerator: {
      generateTopUV(_g, v, a, b, c) {
        const uv = (i: number) => new THREE.Vector2(v[i * 3] / w + 0.5, v[i * 3 + 1] / h + 0.5);
        return [uv(a), uv(b), uv(c)];
      },
      generateSideWallUV() { return [new THREE.Vector2(0, 0), new THREE.Vector2(0, 0), new THREE.Vector2(0, 0), new THREE.Vector2(0, 0)]; },
    },
  });
  // Front face at z = 0 facing +Z, body behind it.
  geometry.translate(0, 0, -depth - bevel);
  return geometry;
}

interface Instrument {
  key: InstrumentKey;
  mesh: Mesh;
  screen: MeshStandardMaterial;
  texture: Texture;
  geometry: BufferGeometry;
  rest: { position: InstanceType<Three["Vector3"]>; quaternion: InstanceType<Three["Quaternion"]> };
  home: InstanceType<Three["Vector3"]>;
  /** 0 first → 1 last to be woken by the ping. */
  order: number;
  seed: number;
}

export interface InstrumentCues {
  time: number;
  /** 0 → 1 as the objects come into being. */
  presence: number;
  /** 0 → 1 as the ping crosses the field. */
  pulse: number;
  /** 0 → 1 lifting off and flying to the wall. */
  align: number;
  /** 0 → 1 wall locked, screens fully lit, ready for the page. */
  flatten: number;
}

export interface InstrumentField {
  group: Group;
  /** Rebuild art and poses for a viewport. `halfWidth/halfHeight` are the wall's half extents in world units. */
  layout(width: number, height: number, halfWidth: number, halfHeight: number): void;
  update(cues: InstrumentCues): void;
  dispose(): void;
}

function easeOutBack(x: number) { const c = 1.35; const p = x - 1; return 1 + (c + 1) * p * p * p + c * p * p; }
function easeInOut(x: number) { return x < 0.5 ? 4 * x * x * x : 1 - Math.pow(-2 * x + 2, 3) / 2; }
function smooth(e0: number, e1: number, x: number) { const t = Math.min(1, Math.max(0, (x - e0) / (e1 - e0 || 1))); return t * t * (3 - 2 * t); }

export function createInstruments(THREE: Three, registry: SceneRegistry, quality: { mobile: boolean }): InstrumentField {
  const group = new THREE.Group();
  const items: Instrument[] = [];
  const pixels = quality.mobile ? 1.2 : 2;
  const causticUniforms = { uCausticTime: { value: 0 }, uCaustic: { value: 1 } };

  const withCaustics = (material: MeshStandardMaterial) => {
    material.onBeforeCompile = (shader) => {
      shader.uniforms.uCausticTime = causticUniforms.uCausticTime;
      shader.uniforms.uCaustic = causticUniforms.uCaustic;
      shader.vertexShader = shader.vertexShader
        .replace("#include <common>", "#include <common>\nvarying vec3 vCausticWorld;")
        .replace("#include <begin_vertex>", "#include <begin_vertex>\n" + CAUSTIC_INJECT.vertex);
      shader.fragmentShader = shader.fragmentShader
        .replace("#include <common>", "#include <common>\n" + CAUSTIC_INJECT.pars)
        .replace("#include <color_fragment>", "#include <color_fragment>\n" + CAUSTIC_INJECT.fragment);
    };
    return material;
  };

  // The glass edge is shared; every screen is its own material.
  const edge = withCaustics(registry.material(new THREE.MeshPhysicalMaterial({
    color: 0x16323b, metalness: 0.55, roughness: 0.28, clearcoat: 1, clearcoatRoughness: 0.2, transparent: true,
  })));

  const position = new THREE.Vector3();
  const quaternion = new THREE.Quaternion();
  const level = new THREE.Quaternion();
  const euler = new THREE.Euler();
  const rand = (i: number, salt: number) => { const v = Math.sin(i * 45.233 + salt * 91.71) * 43758.5453; return (v - Math.floor(v)) * 2 - 1; };

  const clear = () => {
    for (const item of items) {
      group.remove(item.mesh);
      item.texture.dispose();
      item.geometry.dispose();
      item.screen.dispose();
    }
    items.length = 0;
  };

  return {
    group,
    layout(width, height, halfWidth, halfHeight) {
      clear();
      const panels = workspaceLayout(width, height);
      const unit = (halfWidth * 2) / width; // world units per CSS pixel
      panels.forEach(({ key, rect }, index) => {
        const w = rect.w * unit, h = rect.h * unit;
        const big = key === "chat" || key === "map" || key === "header";
        const depth = big ? 0.09 : 0.06;
        const geometry = slabGeometry(THREE, w, h, depth, key === "sonar" ? Math.min(w, h) / 2 : key === "actions" || key === "hint" ? h / 2 : 0.11);
        const texture = paintScreen(THREE, key, rect, pixels);
        // `map` contributes nothing to colour (it is black) but carries the
        // art's alpha, so pieces with transparent ground — the greeting — cut
        // out instead of painting black.
        const screen = withCaustics(registry.material(new THREE.MeshStandardMaterial({
          color: 0x000000, map: texture, emissive: 0xffffff, emissiveMap: texture, emissiveIntensity: 0.12,
          roughness: 0.32, metalness: 0, transparent: true, alphaTest: 0.02,
        })));
        const mesh = new THREE.Mesh(geometry, [screen, edge]);
        // Home: the rect's centre on the wall, surfaces behind, furniture in front.
        const home = new THREE.Vector3(
          ((rect.x + rect.w / 2) / width * 2 - 1) * halfWidth,
          -((rect.y + rect.h / 2) / height * 2 - 1) * halfHeight,
          index * 0.012,
        );
        // Rest: sunk below and around the wall's footprint, tilted like fallen tiles.
        const rest = {
          position: new THREE.Vector3(
            home.x * 0.8 + rand(index, 1) * halfWidth * 0.45,
            -halfHeight * 1.15 - 1.2 + Math.abs(rand(index, 2)) * 1.6 + (big ? 0.6 : 0),
            2.5 + rand(index, 3) * 3.2,
          ),
          quaternion: new THREE.Quaternion().setFromEuler(new THREE.Euler(
            -Math.PI / 2 + rand(index, 4) * 0.55, rand(index, 5) * 0.6, rand(index, 6) * 0.35,
          )),
        };
        mesh.position.copy(rest.position);
        mesh.quaternion.copy(rest.quaternion);
        mesh.renderOrder = index;
        group.add(mesh);
        items.push({
          key, mesh, screen, texture, geometry, rest, home,
          order: Math.min(1, Math.hypot(home.x / halfWidth, home.y / halfHeight) * 0.75),
          seed: index * 1.73,
        });
      });
    },

    update({ time, presence, pulse, align, flatten }) {
      group.visible = presence > 0.001;
      if (!group.visible) return;
      causticUniforms.uCausticTime.value = time;
      causticUniforms.uCaustic.value = 1 - flatten;
      // The glass edge is what sells the slabs as objects; it thins away as the
      // wall locks so the last frame reads as flat as the page beneath it.
      edge.opacity = presence * (1 - flatten * 0.9);
      for (const item of items) {
        const woken = smooth(item.order - 0.05, item.order + 0.2, pulse);
        // Lift, then fly: the order the ping reached it is the order it goes.
        const local = smooth(item.order * 0.28, 0.75 + item.order * 0.25, align);
        const travel = local <= 0 ? 0 : local >= 1 ? 1 : easeOutBack(local);
        const hover = woken * (1 - Math.min(1, align * 2.2));

        position.copy(item.rest.position).lerp(item.home, travel);
        // Woken instruments rise and drift before the flight; asleep ones lie still.
        position.y += hover * (0.55 + Math.sin(time * 0.9 + item.seed) * 0.12);
        position.x += Math.sin(time * 0.5 + item.seed) * 0.08 * hover;
        position.z += Math.cos(time * 0.4 + item.seed * 1.3) * 0.1 * hover;
        // Ballast on the seabed: a slow settle even while asleep.
        position.y += Math.sin(time * 0.35 + item.seed) * 0.02 * (1 - travel);
        item.mesh.position.copy(position);

        euler.set(Math.sin(time * 0.45 + item.seed) * 0.06 * hover, Math.cos(time * 0.38 + item.seed) * 0.05 * hover, 0);
        quaternion.setFromEuler(euler).multiply(item.rest.quaternion);
        item.mesh.quaternion.slerpQuaternions(quaternion, level, easeInOut(Math.max(travel, flatten)));

        // Dark and sunk → lit by the ping → screen-exact for the page.
        const lit = 0.12 + woken * 0.6 + flatten * 0.28;
        item.screen.emissiveIntensity = Math.min(1, lit);
        item.screen.opacity = presence;
        item.screen.roughness = 0.32 + flatten * 0.5;
      }
    },

    dispose() { clear(); },
  };
}

export type { Material };
