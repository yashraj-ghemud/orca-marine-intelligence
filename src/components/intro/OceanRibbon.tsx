"use client";

/**
 * ORCA — OceanRibbon: a compact, always-on Three.js ocean strip.
 *
 * The same shader family as the cinematic intro, shrunk to a living
 * ribbon that glows quietly inside the chat empty-state and the map
 * boot state — the site's own piece of the sea. Sizing is tiny
 * (64×26 segments, DPR ≤ 1.5), renders pause on hidden tabs and the
 * whole scene disposes on unmount; reduced-motion gets a calm static
 * gradient instead.
 */

import { useEffect, useRef, useState } from "react";
import { observeAmbientCanvas, useMotionPreference } from "@/lib/intro";

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
void main(){
  vec3 pos = position;
  float e  = snoise(vec2(pos.x * 0.28, pos.y * 0.34 - uTime * 0.5)) * 0.55
           + snoise(vec2(pos.x * 0.9 + 4.2, pos.y * 1.1 - uTime * 0.8)) * 0.18;
  pos.z += e;
  vElev = e;
  vWorld = (modelMatrix * vec4(pos, 1.0)).xyz;
  gl_Position = projectionMatrix * modelViewMatrix * vec4(pos, 1.0);
}
`;

const FRAG = /* glsl */ `
precision mediump float;
uniform float uTime;
uniform vec3 uDeep;
uniform vec3 uCrest;
uniform vec3 uGlint;
varying float vElev;
varying vec3 vWorld;
void main(){
  float h = smoothstep(-0.75, 0.8, vElev);
  vec3 col = mix(uDeep, uCrest, h);
  float lane = exp(-pow(vWorld.x * 0.55, 2.0));
  col += uGlint * lane * (0.18 + 0.22 * h);
  float a = smoothstep(1.02, 0.86, abs(vWorld.x) * 0.045 + 0.0);
  gl_FragColor = vec4(col, 0.96);
}
`;

export function OceanRibbon({ className }: { className?: string }) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [calm, setCalm] = useState(false);
  const reduced = useMotionPreference();

  useEffect(() => {
    if (calm || reduced || window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;

    const canvas = canvasRef.current;
    if (!canvas) return;

    let disposed = false;
    let stop = () => {};
    let cleanup: (() => void) | undefined;
    const fallback = () => {
      stop();
      cleanup?.();
      cleanup = undefined;
      if (!disposed) setCalm(true);
    };
    canvas.addEventListener("webglcontextlost", fallback);

    void (async () => {
      const THREE = await import("three");
      if (disposed) return;

      const renderer = new THREE.WebGLRenderer({ canvas, alpha: true, antialias: false, powerPreference: "low-power" });
      renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 1.5));

      const scene = new THREE.Scene();
      const camera = new THREE.PerspectiveCamera(46, 6, 0.1, 40);
      camera.position.set(0, 2.35, 5.4);
      camera.lookAt(0, 0.1, 0);

      const geo = new THREE.PlaneGeometry(16, 7, 64, 26);
      const mat = new THREE.ShaderMaterial({
        vertexShader: VERT,
        fragmentShader: FRAG,
        transparent: true,
        uniforms: {
          uTime: { value: 0 },
          uDeep: { value: new THREE.Color(0.05, 0.23, 0.37) },
          uCrest: { value: new THREE.Color(0.32, 0.60, 0.76) },
          uGlint: { value: new THREE.Color(0.66, 0.84, 0.98) },
        },
      });
      const mesh = new THREE.Mesh(geo, mat);
      mesh.rotation.x = -Math.PI / 2.35;
      scene.add(mesh);

      const resize = () => {
        const w = canvas.clientWidth || 200;
        const h = canvas.clientHeight || 64;
        renderer.setSize(w, h, false);
        camera.aspect = w / h;
        camera.updateProjectionMatrix();
      };
      cleanup = () => {
        geo.dispose();
        mat.dispose();
        renderer.dispose();
        renderer.forceContextLoss();
      };
      stop = observeAmbientCanvas(canvas, (time) => {
        mat.uniforms.uTime.value = time;
        try { renderer.render(scene, camera); } catch { fallback(); }
      }, resize);
    })().catch(fallback);

    return () => {
      disposed = true;
      canvas.removeEventListener("webglcontextlost", fallback);
      stop();
      cleanup?.();
    };
  }, [calm, reduced]);

  if (calm || reduced) {
    /* Reduced motion — a still, painted sea */
    return (
      <div
        aria-hidden
        className={className}
        style={{
          background:
            "linear-gradient(180deg, rgba(47,111,149,0.10) 0%, rgba(18,78,120,0.22) 100%)",
        }}
      />
    );
  }

  return <canvas ref={canvasRef} className={className} aria-hidden="true" />;
}
