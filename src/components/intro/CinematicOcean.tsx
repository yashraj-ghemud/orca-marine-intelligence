"use client";

/**
 * ORCA — the cinematic ocean.
 *
 * One WebGL scene, one unbroken camera move: under the hull, up through the
 * surface, around the vessel into the sunrise, then a dive back through the
 * water into the deep — where the workspace's panels lie sunk on the seabed
 * as real objects (`scene/instruments.ts`). A sonar ping wakes them, they
 * rise into a wall that exactly fills the lens, and the page fades in over
 * it.
 *
 * Every visual is a pure function of the story clock, so pausing, seeking
 * and replaying are exact, and a dropped frame costs nothing but the frame.
 */

import { useEffect, useRef, type RefObject } from "react";
import type { BufferGeometry, Material, WebGLRenderer } from "three";
import { INTRO_BEATS, INTRO_DURATION as CINEMATIC_DURATION } from "@/lib/intro";
import { CAUSTIC_INJECT, PULSE_FRAGMENT, PULSE_VERTEX, SKY_FRAGMENT, WATER_FRAGMENT, WATER_VERTEX, WAVES } from "./scene/shaders";
import { boatAt, buildTrack, cuesAt, plungePoint, resolveShot, wallCentre, BOAT_HEADING, WALL_DISTANCE } from "./scene/choreography";
import { createInstruments } from "./scene/instruments";
import { createBirds, createCoast, createGodRays, createMotes, createVessel } from "./scene/world";
import styles from "./CinematicIntro.module.css";

export interface CinematicStage {
  time: number;
  /** Foam across the lens at the plunge. */
  flash: number;
  /** Cross-dissolve from the canvas to the assembled workspace. */
  handoff: number;
}

export interface CinematicOceanProps {
  className?: string;
  cinematic?: boolean;
  paused?: boolean;
  frameKey?: number;
  /** Optional shared story clock, in seconds; standalone heroes animate themselves. */
  timeline?: RefObject<number>;
  /** Per-frame stage report. Mutate DOM directly here — never call setState. */
  onStage?: RefObject<((stage: CinematicStage) => void) | undefined>;
}

export { CINEMATIC_DURATION };

/** Decorative, self-contained scene. Give the hero's parent an explicit height. */
export function CinematicOcean({ className, cinematic = false, paused = false, timeline, frameKey = 0, onStage }: CinematicOceanProps) {
  const host = useRef<HTMLDivElement>(null);
  const canvas = useRef<HTMLCanvasElement>(null);
  const control = useRef<(paused: boolean) => void>(() => {});
  const pausedRef = useRef(paused);

  useEffect(() => {
    pausedRef.current = paused;
    control.current(paused);
  }, [paused, frameKey]);

  useEffect(() => {
    const element = host.current;
    const surface = canvas.current;
    if (!element || !surface) return;
    let disposed = false;
    let failed = false;
    let frame = 0;
    let renderer: WebGLRenderer | undefined;
    let resize: ResizeObserver | undefined;
    let intersection: IntersectionObserver | undefined;
    let stopListeners = () => {};
    const geometries = new Set<BufferGeometry>();
    const materials = new Set<Material>();
    const registry = {
      geometry: <T extends BufferGeometry,>(value: T): T => { geometries.add(value); return value; },
      material: <T extends Material,>(value: T): T => { materials.add(value); return value; },
    };
    let releaseDeep = () => {};
    const release = () => {
      cancelAnimationFrame(frame);
      releaseDeep();
      resize?.disconnect();
      intersection?.disconnect();
      stopListeners();
      control.current = () => {};
      geometries.forEach((value) => value.dispose());
      materials.forEach((value) => value.dispose());
      geometries.clear();
      materials.clear();
      if (renderer) {
        renderer.dispose();
        renderer.forceContextLoss();
        renderer = undefined;
      }
    };
    const fallback = () => {
      failed = true;
      element.dataset.ready = "false";
      release();
    };

    void import("three").then((THREE) => {
      if (disposed) return;
      renderer = new THREE.WebGLRenderer({ canvas: surface, alpha: false, antialias: true, powerPreference: "low-power" });
      renderer.outputColorSpace = THREE.SRGBColorSpace;
      renderer.toneMapping = THREE.ACESFilmicToneMapping;
      renderer.toneMappingExposure = 1.08;
      renderer.debug.onShaderError = () => { failed = true; };
      const scene = new THREE.Scene();
      scene.fog = new THREE.FogExp2(0x718d91, 0.007);
      const camera = new THREE.PerspectiveCamera(48, 1, 0.15, 1400);
      const reduced = window.matchMedia("(prefers-reduced-motion: reduce)");
      const mobile = window.matchMedia("(max-width: 700px), (pointer: coarse)").matches;
      let dpr = Math.min(window.devicePixelRatio || 1, mobile ? 1.15 : 1.5);

      const skyMaterial = registry.material(new THREE.ShaderMaterial({
        side: THREE.BackSide,
        depthWrite: false,
        uniforms: { uUnder: { value: 0 } },
        vertexShader: "varying vec3 vDirection; void main() { vDirection = position; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }",
        fragmentShader: SKY_FRAGMENT,
      }));
      const sky = new THREE.Mesh(registry.geometry(new THREE.SphereGeometry(900, 32, 16)), skyMaterial);
      scene.add(sky);

      const grid = registry.geometry(new THREE.PlaneGeometry(2, 2, mobile ? 128 : 192, mobile ? 128 : 192));
      grid.rotateX(-Math.PI / 2);
      const vertices = grid.attributes.position;
      // Concentrate vertices near the vessel; the far field fades into sea mist.
      for (let i = 0; i < vertices.count; i++) {
        const x = vertices.getX(i), z = vertices.getZ(i);
        vertices.setXYZ(i, Math.sign(x) * x * x * 600, 0, Math.sign(z) * z * z * 600);
      }
      grid.computeBoundingSphere();
      const water = registry.material(new THREE.ShaderMaterial({
        vertexShader: WATER_VERTEX,
        fragmentShader: WATER_FRAGMENT,
        // The camera starts beneath it and ends beneath it: two-sided.
        side: THREE.DoubleSide,
        uniforms: {
          uTime: { value: 0 },
          uBoat: { value: new THREE.Vector2(5, -3) },
          uHeading: { value: new THREE.Vector2(BOAT_HEADING.x, BOAT_HEADING.z) },
          uImpact: { value: new THREE.Vector3(0, 0, 0) },
        },
      }));
      const surfaceMesh = new THREE.Mesh(grid, water);
      surfaceMesh.frustumCulled = false;
      scene.add(surfaceMesh);

      scene.add(new THREE.HemisphereLight(0xb9dcdd, 0x102b35, 2.3));
      const sunlight = new THREE.DirectionalLight(0xffd1a0, 3.0);
      sunlight.position.set(2, 12, -40);
      scene.add(sunlight);
      const coast = createCoast(THREE, registry);
      scene.add(coast);

      const birds = createBirds(THREE, registry, mobile ? 5 : 9);
      scene.add(birds.mesh);

      const vessel = createVessel(THREE, registry);
      scene.add(vessel);

      const rays = createGodRays(THREE, registry);
      scene.add(rays.mesh);
      const plankton = createMotes(THREE, registry, {
        count: mobile ? 260 : 520, spread: [16, 10, 16], centre: [0, -6, 0],
        color: 0xbfe6dd, size: 1.5, drift: 0.5,
      });
      scene.add(plankton.points);
      // Bubbles: a column of them climbing past the lens in the deep.
      const bubbles = createMotes(THREE, registry, {
        count: mobile ? 160 : 340, spread: [9, 7, 9], centre: [0, 0, 0],
        color: 0xd8f4ee, size: 2.1, drift: 0.25, rise: 1.4,
      });
      scene.add(bubbles.points);

      // Illustrative signal rings and the route, as in the workspace overlays.
      const signalPaint = registry.material(new THREE.MeshBasicMaterial({ color: 0xb9e7d8, transparent: true, opacity: 0, side: THREE.DoubleSide, depthWrite: false }));
      const signalShape = registry.geometry(new THREE.RingGeometry(0.985, 1, 96));
      const signals = Array.from({ length: 3 }, () => {
        const ring = new THREE.Mesh(signalShape, signalPaint);
        ring.rotation.x = -Math.PI / 2;
        scene.add(ring);
        return ring;
      });
      const routeCurve = new THREE.CatmullRomCurve3([
        new THREE.Vector3(0, 0, 0), new THREE.Vector3(-3, 0, -8),
        new THREE.Vector3(2, 0, -19), new THREE.Vector3(-1, 0, -34),
      ]);
      const routePaint = registry.material(new THREE.MeshBasicMaterial({ color: 0xe8ca9b, transparent: true, opacity: 0, depthWrite: false }));
      const course = new THREE.Mesh(registry.geometry(new THREE.TubeGeometry(routeCurve, 60, 0.045, 5, false)), routePaint);
      scene.add(course);

      /* ── The deep: seabed, the sunken instruments, the ping ─────── */
      const wall = wallCentre();
      const deep = new THREE.Group();
      deep.position.set(wall.x, wall.y, wall.z);
      scene.add(deep);

      const seabedUniforms = { uCausticTime: { value: 0 }, uCaustic: { value: 1 } };
      const sand = registry.material(new THREE.MeshStandardMaterial({ color: 0x1d3a44, roughness: 0.95, metalness: 0 }));
      sand.onBeforeCompile = (shader) => {
        shader.uniforms.uCausticTime = seabedUniforms.uCausticTime;
        shader.uniforms.uCaustic = seabedUniforms.uCaustic;
        shader.vertexShader = shader.vertexShader
          .replace("#include <common>", "#include <common>\nvarying vec3 vCausticWorld;")
          .replace("#include <begin_vertex>", "#include <begin_vertex>\n" + CAUSTIC_INJECT.vertex);
        shader.fragmentShader = shader.fragmentShader
          .replace("#include <common>", "#include <common>\n" + CAUSTIC_INJECT.pars)
          .replace("#include <color_fragment>", "#include <color_fragment>\n" + CAUSTIC_INJECT.fragment);
      };
      const floorGeometry = registry.geometry(new THREE.PlaneGeometry(90, 90, 48, 48));
      const floorHeights = floorGeometry.attributes.position;
      // Low dunes; nothing that reads as terrain, just a ground for the light to play on.
      for (let i = 0; i < floorHeights.count; i++) {
        const x = floorHeights.getX(i), y = floorHeights.getY(i);
        floorHeights.setZ(i, Math.sin(x * 0.21) * Math.cos(y * 0.17) * 0.7 + Math.sin(x * 0.6 + y * 0.4) * 0.15);
      }
      floorGeometry.computeVertexNormals();
      const seabed = new THREE.Mesh(floorGeometry, sand);
      seabed.rotation.x = -Math.PI / 2;
      seabed.position.y = -7.2;
      deep.add(seabed);

      const instruments = createInstruments(THREE, registry, { mobile });
      deep.add(instruments.group);
      releaseDeep = () => instruments.dispose();

      const pulseMaterial = registry.material(new THREE.ShaderMaterial({
        vertexShader: PULSE_VERTEX, fragmentShader: PULSE_FRAGMENT,
        uniforms: { uProgress: { value: 0 }, uOpacity: { value: 0 } },
        transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, side: THREE.DoubleSide,
      }));
      const ping = new THREE.Mesh(registry.geometry(new THREE.PlaneGeometry(1, 1)), pulseMaterial);
      ping.rotation.x = -Math.PI / 2;
      ping.position.set(0, -6.9, 1.5);
      ping.scale.setScalar(46);
      ping.renderOrder = 40;
      deep.add(ping);
      // The ping carries its own light: the instruments catch it as it passes.
      const pingLight = new THREE.PointLight(0x9fe8d8, 0, 26, 1.6);
      pingLight.position.set(0, -3, 3);
      deep.add(pingLight);
      const deepSun = new THREE.DirectionalLight(0x8fd2d6, 1.6);
      deepSun.position.set(2, 20, 6);
      deepSun.target = seabed;
      deep.add(deepSun);

      const track = buildTrack(THREE);
      const splashAt = plungePoint();
      const cameraPosition = new THREE.Vector3();
      const cameraTarget = new THREE.Vector3();
      const up = new THREE.Vector3(0, 1, 0);
      const normal = new THREE.Vector3();
      const heading = new THREE.Quaternion().setFromAxisAngle(up, -0.18);

      let time = 0;
      let last = performance.now();
      let inView = true;
      let sized = false;
      let slowFrames = 0;
      let samples = 0;
      const canRun = () => !disposed && !failed && !pausedRef.current && !reduced.matches && !document.hidden && inView && sized;

      const draw = () => {
        if (!renderer || disposed || failed) return;
        const sceneTime = cinematic && timeline ? timeline.current : time;
        // Everything above the surface is out of frame from the deep.
        const surfaceWorld = !cinematic || sceneTime < INTRO_BEATS.plunge + 0.5;
        vessel.visible = surfaceWorld;
        birds.mesh.visible = surfaceWorld;
        course.visible = surfaceWorld;
        coast.visible = surfaceWorld;
        for (const ring of signals) ring.visible = surfaceWorld;
        const cues = cinematic ? cuesAt(sceneTime) : { rays: 0, signals: 0, route: 0, splash: 0, flash: 0, handoff: 0, bubbles: 0, presence: 0, pulse: 0, align: 0, flatten: 0 };

        /* Water and vessel — a closed form of the clock, never integrated. */
        const waveTime = sceneTime * (cinematic ? 0.85 : 0.65) + (cinematic ? 0 : 18);
        water.uniforms.uTime.value = waveTime;
        const boat = boatAt(sceneTime);
        let height = 0, dx = 0, dz = 0;
        for (const [x, z, frequency, amplitude, speed] of WAVES) {
          const phase = (boat.x * x + boat.z * z) * frequency - waveTime * speed;
          height += Math.sin(phase) * amplitude;
          dx += Math.cos(phase) * amplitude * frequency * x;
          dz += Math.cos(phase) * amplitude * frequency * z;
        }
        vessel.position.set(boat.x, height + 0.08, boat.z);
        normal.set(-dx * 0.7, 1, -dz * 0.7).normalize();
        vessel.quaternion.setFromUnitVectors(up, normal).multiply(heading);
        water.uniforms.uBoat.value.set(boat.x, boat.z);
        water.uniforms.uImpact.value.set(splashAt.x, splashAt.z, cues.splash);
        surfaceMesh.position.set(boat.x - 5, 0, boat.z + 3);

        signalPaint.opacity = cues.signals * 0.24;
        for (let i = 0; i < signals.length; i++) {
          signals[i].position.set(boat.x, 0.65, boat.z);
          signals[i].scale.setScalar(4 + ((sceneTime * 0.7 + i * 4) % 12));
        }
        routePaint.opacity = cues.route * 0.48;
        course.position.set(boat.x, 0.72, boat.z);

        /* Camera. */
        let fov: number;
        let roll = 0;
        if (cinematic && !reduced.matches) {
          const shot = resolveShot(track, sceneTime, camera.aspect, cameraPosition, cameraTarget);
          fov = shot.fov;
          roll = shot.roll;
          skyMaterial.uniforms.uUnder.value = shot.under;
        } else {
          cameraPosition.set(boat.x + 10 + Math.sin(sceneTime * 0.045) * 1.2, 6.2, boat.z + 26);
          cameraTarget.set(boat.x - 7, 1.1, boat.z - 9);
          fov = camera.aspect < 0.8 ? 58 : 48;
          skyMaterial.uniforms.uUnder.value = 0;
        }
        camera.position.copy(cameraPosition);
        camera.up.set(Math.sin(roll), Math.cos(roll), 0);
        camera.lookAt(cameraTarget);
        if (Math.abs(camera.fov - fov) > 0.01) {
          camera.fov = fov;
          camera.updateProjectionMatrix();
        }

        /* Under the surface: shafts and particulate travel with the lens. */
        rays.material.uniforms.uStrength.value = cues.rays * 0.85;
        rays.material.uniforms.uTime.value = sceneTime;
        rays.mesh.position.set(camera.position.x, -17, camera.position.z);
        plankton.material.uniforms.uTime.value = sceneTime;
        plankton.material.uniforms.uOpacity.value = cues.rays * 0.9;
        plankton.points.position.set(camera.position.x, Math.min(0, camera.position.y + 2), camera.position.z);
        bubbles.material.uniforms.uTime.value = sceneTime;
        bubbles.material.uniforms.uOpacity.value = cues.bubbles;
        bubbles.points.position.set(camera.position.x + 1.5, camera.position.y - 1, camera.position.z - 5);

        birds.update(sceneTime, boat.x, boat.z);
        sky.position.copy(camera.position);

        /* The deep. */
        deep.visible = cues.presence > 0.001;
        if (deep.visible) {
          seabedUniforms.uCausticTime.value = sceneTime;
          instruments.update({ time: sceneTime, presence: cues.presence, pulse: cues.pulse, align: cues.align, flatten: cues.flatten });
          pulseMaterial.uniforms.uProgress.value = cues.pulse * 1.1;
          pulseMaterial.uniforms.uOpacity.value = Math.min(1, cues.pulse * 6) * (1 - Math.max(0, cues.pulse - 0.8) / 0.2);
          pingLight.intensity = Math.sin(Math.min(1, cues.pulse) * Math.PI) * 55 * (1 - cues.flatten);
          pingLight.position.set(0, -4 + cues.pulse * 3, 4 - cues.pulse * 2);
        }

        try {
          renderer.render(scene, camera);
          if (failed) fallback();
          else element.dataset.ready = "true";
        } catch {
          fallback();
        }
        onStage?.current?.({ time: sceneTime, flash: cues.flash, handoff: cues.handoff });
      };

      const fit = () => {
        if (!renderer || disposed || failed) return;
        const { width, height } = element.getBoundingClientRect();
        sized = width > 0 && height > 0;
        if (!sized) return;
        // Bound fill rate on large/retina displays as well as small phones.
        const ratio = Math.min(dpr, Math.sqrt(1_900_000 / (width * height)));
        renderer.setPixelRatio(ratio);
        renderer.setSize(width, height, false);
        camera.aspect = width / height;
        camera.fov = width / height < 0.8 ? 58 : 48;
        camera.updateProjectionMatrix();
        // The wall of instruments is sized to fill this frustum at WALL_DISTANCE.
        const halfHeight = Math.tan((camera.fov * Math.PI) / 360) * WALL_DISTANCE;
        instruments.layout(width, height, halfHeight * camera.aspect, halfHeight);
      };
      const animate = (now: number) => {
        if (!canRun()) return;
        const elapsed = now - last;
        if (elapsed >= 1000 / (cinematic && !mobile ? 60 : 30) - 1) {
          time += Math.min(elapsed, 100) / 1000;
          last = now;
          if (elapsed > 65) slowFrames++;
          if (++samples >= 60) {
            if (slowFrames > 12 && dpr > 0.8) {
              dpr = Math.max(0.8, dpr - 0.2);
              fit();
            }
            samples = 0;
            slowFrames = 0;
          }
          draw();
        }
        if (canRun()) frame = requestAnimationFrame(animate);
      };
      const resume = () => {
        cancelAnimationFrame(frame);
        last = performance.now();
        if (!document.hidden && inView && sized) draw();
        if (canRun()) frame = requestAnimationFrame(animate);
      };
      const lost = (event: Event) => {
        event.preventDefault();
        fallback();
      };
      const resized = () => { fit(); resume(); };
      stopListeners = () => {
        document.removeEventListener("visibilitychange", resume);
        reduced.removeEventListener("change", resume);
        surface.removeEventListener("webglcontextlost", lost);
        window.removeEventListener("resize", resized);
      };
      document.addEventListener("visibilitychange", resume);
      reduced.addEventListener("change", resume);
      surface.addEventListener("webglcontextlost", lost);
      control.current = resume;
      if (typeof ResizeObserver !== "undefined") {
        resize = new ResizeObserver(resized);
        resize.observe(element);
      } else window.addEventListener("resize", resized);
      if ("IntersectionObserver" in window) {
        intersection = new IntersectionObserver(([entry]) => { inView = entry.isIntersecting; resume(); }, { threshold: 0 });
        intersection.observe(element);
      }
      fit();
      resume();
    }).catch(() => { if (!disposed) fallback(); });

    return () => {
      disposed = true;
      element.dataset.ready = "false";
      release();
    };
  }, [cinematic, timeline, onStage]);

  return (
    <div ref={host} className={`${styles.ocean}${className ? ` ${className}` : ""}`} aria-hidden="true">
      <div className={styles.fallback}>
        {/* A complete painted story remains available before loading or without WebGL. */}
        <svg className={styles.fallbackStory} viewBox="0 0 1000 800" preserveAspectRatio="xMaxYMid slice" fill="none">
          <g className={styles.fallbackSignals} stroke="#b9e7d8" strokeWidth="1.5">
            <ellipse cx="740" cy="570" rx="95" ry="20" />
            <ellipse cx="740" cy="570" rx="155" ry="36" opacity=".65" />
            <ellipse cx="740" cy="570" rx="220" ry="55" opacity=".35" />
          </g>
          <path className={styles.fallbackCourse} d="M740 565C685 532 790 491 742 462S697 429 744 405" stroke="#e8ca9b" strokeWidth="2" strokeDasharray="5 7" />
          <g transform="translate(740 548)" strokeLinejoin="round">
            <path d="M-68 19Q0 38 60 15L39 43Q0 57-50 42Z" fill="#082d39" stroke="#9ebcaf" strokeWidth="2" />
            <path d="M-24 18V-18H23L32 21" fill="#c0c4b0" stroke="#173f48" strokeWidth="2" />
            <path d="M-29-20H28" stroke="#95b6a4" strokeWidth="6" />
            <path d="M-16-11H-1V3H-16ZM6-11H20V3H6Z" fill="#12333d" />
            <path d="M0-22V-80M-24-58H24M0-74L-47 18M0-74L47 18" stroke="#a5b9ac" strokeWidth="1.5" />
            <circle cy="-82" r="3" fill="#ffce87" />
            <path d="M-44 50Q0 66 43 49M-62 59Q0 81 66 59" stroke="#b9e7d8" opacity=".3" />
          </g>
        </svg>
      </div>
      <canvas ref={canvas} className={styles.canvas} />
    </div>
  );
}
