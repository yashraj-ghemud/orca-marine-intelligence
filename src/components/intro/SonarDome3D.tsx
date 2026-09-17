"use client";

/**
 * ORCA — SonarDome3D: a live Three.js instrument on the map.
 *
 * A compact glass porthole holding a wireframe sonar dome: an icosphere
 * cage slowly turning around a breathing core, crossed by two orbit
 * rings sweeping opposite directions — the station's depth instrument.
 *
 * Budget-conscious by design: ~1.2k tris, DPR ≤ 1.5, renders pause on
 * hidden tabs, full disposal on unmount and a painted still-water
 * fallback under prefers-reduced-motion.
 */

import { useEffect, useRef, useState } from "react";
import { observeAmbientCanvas, useMotionPreference } from "@/lib/intro";

export function SonarDome3D({ size = 76 }: { size?: number }) {
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

      const renderer = new THREE.WebGLRenderer({
        canvas,
        alpha: true,
        antialias: true,
        powerPreference: "low-power",
      });
      renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 1.5));

      const scene = new THREE.Scene();
      const camera = new THREE.PerspectiveCamera(38, 1, 0.1, 30);
      camera.position.set(0, 0.9, 3.6);
      camera.lookAt(0, 0, 0);

      const group = new THREE.Group();
      scene.add(group);

      /* Wireframe dome cage */
      const cageGeo = new THREE.IcosahedronGeometry(1, 1);
      const cageMat = new THREE.LineBasicMaterial({
        color: 0x4a8db8,
        transparent: true,
        opacity: 0.62,
      });
      const cage = new THREE.LineSegments(new THREE.WireframeGeometry(cageGeo), cageMat);
      group.add(cage);

      /* Breathing core */
      const coreGeo = new THREE.SphereGeometry(0.34, 20, 14);
      const coreMat = new THREE.MeshBasicMaterial({
        color: 0x2f6f95,
        transparent: true,
        opacity: 0.5,
      });
      const core = new THREE.Mesh(coreGeo, coreMat);
      group.add(core);

      /* Halo behind the core */
      const haloGeo = new THREE.SphereGeometry(0.52, 16, 12);
      const haloMat = new THREE.MeshBasicMaterial({
        color: 0x8fd0f5,
        transparent: true,
        opacity: 0.14,
      });
      const halo = new THREE.Mesh(haloGeo, haloMat);
      group.add(halo);

      /* Orbit rings — sonar sweeps on two axes */
      const ringGeo = new THREE.TorusGeometry(1.32, 0.011, 6, 72);
      const ringMat = new THREE.MeshBasicMaterial({
        color: 0x7fb3d5,
        transparent: true,
        opacity: 0.78,
      });
      const ringA = new THREE.Mesh(ringGeo, ringMat);
      ringA.rotation.x = Math.PI / 2.25;
      const ringB = new THREE.Mesh(ringGeo, ringMat.clone());
      ringB.rotation.x = Math.PI / 1.9;
      ringB.rotation.y = Math.PI / 3.1;
      group.add(ringA, ringB);

      /* Scan blip riding ring A */
      const blipGeo = new THREE.SphereGeometry(0.045, 8, 6);
      const blipMat = new THREE.MeshBasicMaterial({ color: 0xd9edfb });
      const blip = new THREE.Mesh(blipGeo, blipMat);
      group.add(blip);

      const resize = () => {
        const w = canvas.clientWidth || size;
        const h = canvas.clientHeight || size;
        renderer.setSize(w, h, false);
        camera.aspect = w / h;
        camera.updateProjectionMatrix();
      };
      const tick = (t: number) => {

        group.rotation.y = t * 0.24;
        group.position.y = Math.sin(t * 0.8) * 0.045;

        const pulse = 1 + 0.13 * Math.sin(t * 2.1);
        core.scale.setScalar(pulse);
        halo.scale.setScalar(1 + 0.09 * Math.sin(t * 1.5 + 1));

        ringA.rotation.z = t * 0.5;
        ringB.rotation.z = -t * 0.36;

        /* Blip orbits ring A */
        const a = t * 1.15;
        blip.position
          .set(Math.cos(a) * 1.32, Math.sin(a) * 1.32, 0)
          .applyEuler(ringA.rotation);

        try { renderer.render(scene, camera); } catch { fallback(); }
      };

      cleanup = () => {
        cageGeo.dispose();
        cage.geometry.dispose();
        cageMat.dispose();
        coreGeo.dispose();
        coreMat.dispose();
        haloGeo.dispose();
        haloMat.dispose();
        ringGeo.dispose();
        ringA.material.dispose();
        ringB.material.dispose();
        blipGeo.dispose();
        blipMat.dispose();
        renderer.dispose();
        renderer.forceContextLoss();
      };
      stop = observeAmbientCanvas(canvas, tick, resize);
    })().catch(fallback);

    return () => {
      disposed = true;
      canvas.removeEventListener("webglcontextlost", fallback);
      stop();
      cleanup?.();
    };
  }, [size, calm, reduced]);

  return (
    <span
      aria-hidden
      className="pointer-events-none relative flex items-center justify-center overflow-hidden rounded-full border border-ocean-line bg-white/72 shadow-[0_2px_12px_rgba(23,35,45,0.14)] backdrop-blur-[3px]"
      style={{ width: size, height: size }}
    >
      {/* Inner glass sheen */}
      <span
        className="absolute inset-0 rounded-full"
        style={{
          background:
            "radial-gradient(circle at 32% 24%, rgba(255,255,255,0.85) 0%, rgba(255,255,255,0.08) 46%, transparent 62%)",
        }}
      />
      {calm || reduced ? (
        /* Reduced motion — a still instrument face */
        <span className="dome-glow absolute inset-[22%] rounded-full bg-ocean-blue/40" />
      ) : (
        <canvas ref={canvasRef} style={{ width: size, height: size }} />
      )}
      <span className="dome-glow absolute bottom-[7px] h-[3px] w-[3px] rounded-full bg-ocean-blue" />
    </span>
  );
}
