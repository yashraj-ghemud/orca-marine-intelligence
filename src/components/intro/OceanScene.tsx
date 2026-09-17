"use client";

/**
 * ORCA — Cinematic ocean (Three.js).
 *
 * A custom-shader ocean surface: three octaves of simplex noise displace
 * a dense plane; the fragment shader mixes deep/crest blues by elevation,
 * paints a moon light-lane down the middle, sparkles crest glints and
 * dissolves into the horizon with distance fog. Two particle layers —
 * plankton drifting up and a rush streak field flying past the camera —
 * sell the dolly back-and-up "zoom out to the vast ocean" beat.
 *
 * Everything disposes on unmount, renders are skipped when the tab is
 * hidden and the pixel ratio is capped for phones.
 */

import { useEffect, useRef } from "react";

const SIMPLEX = /* glsl */ `
vec3 mod289(vec3 x){return x - floor(x * (1.0/289.0)) * 289.0;}
vec2 mod289(vec2 x){return x - floor(x * (1.0/289.0)) * 289.0;}
vec3 permute(vec3 x){return mod289(((x*34.0)+1.0)*x);}
float snoise(vec2 v){
  const vec4 C = vec4(0.211324865405187, 0.366025403784439, -0.577350269189626, 0.024390243902439);
  vec2 i  = floor(v + dot(v, C.yy));
  vec2 x0 = v -   i + dot(i, C.xx);
  vec2 i1 = (x0.x > x0.y) ? vec2(1.0, 0.0) : vec2(0.0, 1.0);
  vec4 x12 = x0.xyxy + C.xxzz;
  x12.xy -= i1;
  i = mod289(i);
  vec3 p = permute( permute( i.y + vec3(0.0, i1.y, 1.0 )) + i.x + vec3(0.0, i1.x, 1.0 ));
  vec3 m = max(0.5 - vec3(dot(x0,x0), dot(x12.xy,x12.xy), dot(x12.zw,x12.zw)), 0.0);
  m = m*m; m = m*m;
  vec3 x = 2.0 * fract(p * C.www) - 1.0;
  vec3 h = abs(x) - 0.5;
  vec3 ox = floor(x + 0.5);
  vec3 a0 = x - ox;
  m *= 1.79284291400159 - 0.85373472095314 * ( a0*a0 + h*h );
  vec3 g;
  g.x  = a0.x  * x0.x  + h.x  * x0.y;
  g.yz = a0.yz * x12.xz + h.yz * x12.yw;
  return 130.0 * dot(m, g);
}
`;

const VERT = /* glsl */ `
uniform float uTime;
varying float vElev;
varying vec3 vWorld;
${SIMPLEX}
float ocean(vec2 p, float t){
  float e = 0.0;
  e += snoise(vec2(p.x * 0.055, p.y * 0.075 - t * 0.30)) * 1.35;
  e += snoise(vec2(p.x * 0.16 + 7.3, p.y * 0.22 - t * 0.45)) * 0.55;
  e += snoise(vec2(p.x * 0.50 - 3.1, p.y * 0.62 - t * 0.80)) * 0.16;
  return e;
}
void main(){
  vec3 pos = position;
  float e = ocean(pos.xy, uTime);
  pos.z += e;
  vElev = e;
  vWorld = (modelMatrix * vec4(pos, 1.0)).xyz;
  gl_Position = projectionMatrix * modelViewMatrix * vec4(pos, 1.0);
}
`;

const FRAG = /* glsl */ `
precision highp float;
uniform float uTime;
uniform vec3 uDeep;
uniform vec3 uCrest;
uniform vec3 uFog;
uniform vec3 uMoon;
varying float vElev;
varying vec3 vWorld;
${SIMPLEX}
void main(){
  float h = smoothstep(-1.6, 1.9, vElev);
  vec3 col = mix(uDeep, uCrest, h);
  /* Moon lane — a shimmering column of light down the water */
  float lane = exp(-pow(vWorld.x * 0.10, 2.0));
  float sp = snoise(vec2(vWorld.x * 0.55 + uTime * 0.35, vWorld.z * 0.55 - uTime * 0.5));
  col += uMoon * lane * (0.13 + 0.34 * max(sp, 0.0) * (0.35 + 0.65 * h));
  /* Crest glints — sun catching the tips of the swell */
  float glint = snoise(vec2(vWorld.x * 1.55 + uTime * 0.9, vWorld.z * 1.55 - uTime * 0.7));
  float sparkle = pow(max(glint, 0.0), 5.0) * smoothstep(0.55, 1.5, vElev);
  col += vec3(0.85, 0.95, 1.0) * sparkle * 0.55;
  /* Distance fog into the horizon */
  float d = length(vWorld.xz - vec2(0.0, -6.0));
  float fogF = smoothstep(15.0, 50.0, d);
  col = mix(col, uFog, fogF);
  gl_FragColor = vec4(col, 1.0);
}
`;

const easeInOutCubic = (t: number) => (t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2);

export function OceanScene({ className }: { className?: string }) {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;

    let disposed = false;
    let raf = 0;
    let cleanup: (() => void) | undefined;

    void (async () => {
      const THREE = await import("three");
      if (disposed) return;

      const renderer = new THREE.WebGLRenderer({
        canvas,
        alpha: true,
        antialias: false,
        powerPreference: "high-performance",
      });
      renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 1.75));

      const scene = new THREE.Scene();
      const camera = new THREE.PerspectiveCamera(60, 1, 0.1, 220);

      /* ── Ocean surface ─────────────────────────────────── */
      const geo = new THREE.PlaneGeometry(110, 64, 150, 96);
      const mat = new THREE.ShaderMaterial({
        vertexShader: VERT,
        fragmentShader: FRAG,
        uniforms: {
          uTime: { value: 0 },
          uDeep: { value: new THREE.Color(0.016, 0.086, 0.165) },
          uCrest: { value: new THREE.Color(0.23, 0.46, 0.62) },
          uFog: { value: new THREE.Color(0.075, 0.24, 0.39) },
          uMoon: { value: new THREE.Color(0.72, 0.86, 1.0) },
        },
      });
      const ocean = new THREE.Mesh(geo, mat);
      ocean.rotation.x = -Math.PI / 2;
      ocean.position.z = -12;
      scene.add(ocean);

      /* ── Plankton drift ────────────────────────────────── */
      const N = 240;
      const pGeo = new THREE.BufferGeometry();
      const pPos = new Float32Array(N * 3);
      for (let i = 0; i < N; i++) {
        pPos[i * 3] = (Math.random() - 0.5) * 56;
        pPos[i * 3 + 1] = 0.3 + Math.random() * 7;
        pPos[i * 3 + 2] = -44 + Math.random() * 46;
      }
      pGeo.setAttribute("position", new THREE.BufferAttribute(pPos, 3));
      const pMat = new THREE.PointsMaterial({
        size: 0.085,
        color: 0x9fd4f0,
        transparent: true,
        opacity: 0.5,
        blending: THREE.AdditiveBlending,
        depthWrite: false,
        sizeAttenuation: true,
      });
      const points = new THREE.Points(pGeo, pMat);
      scene.add(points);

      /* ── Rush streaks — speed field flying past the camera ── */
      const RN = 170;
      const rGeo = new THREE.BufferGeometry();
      const rPos = new Float32Array(RN * 3);
      for (let i = 0; i < RN; i++) {
        rPos[i * 3] = (Math.random() - 0.5) * 44;
        rPos[i * 3 + 1] = 0.4 + Math.random() * 8.6;
        rPos[i * 3 + 2] = -38 + Math.random() * 50;
      }
      rGeo.setAttribute("position", new THREE.BufferAttribute(rPos, 3));
      const rMat = new THREE.PointsMaterial({
        size: 0.05,
        color: 0xbfe2f7,
        transparent: true,
        opacity: 0.34,
        blending: THREE.AdditiveBlending,
        depthWrite: false,
        sizeAttenuation: true,
      });
      const rush = new THREE.Points(rGeo, rMat);
      scene.add(rush);

      /* ── Camera choreography: low over the swell → vast reveal ── */
      const CAM_FROM = { x: 0, y: 1.9, z: 10.2 };
      const CAM_TO = { x: 0, y: 9.4, z: 21.5 };
      const LOOK = new THREE.Vector3(0, 0.4, -5);

      const resize = () => {
        const w = canvas.clientWidth || window.innerWidth;
        const h = canvas.clientHeight || window.innerHeight;
        renderer.setSize(w, h, false);
        camera.aspect = w / h;
        /* Portrait phones need a wider lens to feel vast */
        camera.fov = camera.aspect < 0.8 ? 76 : 60;
        camera.updateProjectionMatrix();
      };
      resize();
      window.addEventListener("resize", resize);

      const start = performance.now();
      const hidden = () => document.visibilityState === "hidden";

      const tick = () => {
        raf = requestAnimationFrame(tick);
        if (hidden()) return;
        const t = (performance.now() - start) / 1000;

        mat.uniforms.uTime.value = t;

        /* Plankton rise, wrap at the top */
        const arr = pGeo.attributes.position.array as Float32Array;
        for (let i = 0; i < N; i++) {
          arr[i * 3 + 1] += 0.10 * (1 / 60);
          arr[i * 3] += Math.sin(t * 0.4 + i) * 0.0016;
          if (arr[i * 3 + 1] > 7.6) arr[i * 3 + 1] = 0.3;
        }
        pGeo.attributes.position.needsUpdate = true;

        /* Rush streaks race toward the camera, wrap far behind */
        const rrr = rGeo.attributes.position.array as Float32Array;
        for (let i = 0; i < RN; i++) {
          rrr[i * 3 + 2] += 7.2 * (1 / 60);
          rrr[i * 3 + 1] += 0.6 * (1 / 60);
          if (rrr[i * 3 + 2] > 14) {
            rrr[i * 3 + 2] = -40;
            rrr[i * 3 + 1] = 0.4 + Math.random() * 8.6;
          }
        }
        rGeo.attributes.position.needsUpdate = true;

        /* Dolly-out with cinematic ease, then a slow living bob.
           A faint roll (via the up vector) keeps the frame feeling
           hand-flown rather than rail-bound. */
        const k = easeInOutCubic(Math.min(Math.max((t - 0.25) / 5.4, 0), 1));
        const bob = 0.12 * Math.sin(t * 0.5);
        camera.position.set(
          CAM_FROM.x + (CAM_TO.x - CAM_FROM.x) * k,
          CAM_FROM.y + (CAM_TO.y - CAM_FROM.y) * k + bob,
          CAM_FROM.z + (CAM_TO.z - CAM_FROM.z) * k,
        );
        camera.up.set(Math.sin(t * 0.22) * 0.012, 1, 0);
        camera.lookAt(LOOK);

        renderer.render(scene, camera);
      };
      tick();

      cleanup = () => {
        window.removeEventListener("resize", resize);
        geo.dispose();
        mat.dispose();
        pGeo.dispose();
        pMat.dispose();
        rGeo.dispose();
        rMat.dispose();
        renderer.dispose();
      };
    })();

    return () => {
      disposed = true;
      cancelAnimationFrame(raf);
      cleanup?.();
    };
  }, []);

  return <canvas ref={canvasRef} className={className} aria-hidden="true" />;
}
