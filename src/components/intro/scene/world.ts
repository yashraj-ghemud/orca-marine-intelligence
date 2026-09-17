/**
 * ORCA — the ocean world: the fishing vessel, the headlands behind it, the
 * birds working the sunrise, and the volumetric shafts and particulate that
 * only exist while the camera is under the surface.
 */

import type { BufferGeometry, Group, InstancedMesh, Material, Mesh, Object3D, ShaderMaterial } from "three";
import { GODRAY_FRAGMENT, GODRAY_VERTEX, MOTE_FRAGMENT, MOTE_VERTEX } from "./shaders";

type Three = typeof import("three");

/** Tracks geometries and materials so the scene can release them as a set. */
export interface SceneRegistry {
  geometry<T extends BufferGeometry>(value: T): T;
  material<T extends Material>(value: T): T;
}

export function createVessel(THREE: Three, registry: SceneRegistry) {
  const vessel = new THREE.Group();
  const navy = registry.material(new THREE.MeshStandardMaterial({ color: 0x123c45, roughness: 0.46, metalness: 0.15 }));
  const mint = registry.material(new THREE.MeshStandardMaterial({ color: 0x8cae9e, roughness: 0.6 }));
  const cream = registry.material(new THREE.MeshStandardMaterial({ color: 0xd1ccb4, roughness: 0.68 }));
  const wood = registry.material(new THREE.MeshStandardMaterial({ color: 0x6c4c37, roughness: 0.84 }));
  const metal = registry.material(new THREE.MeshStandardMaterial({ color: 0x4e6668, roughness: 0.38, metalness: 0.65 }));
  const glass = registry.material(new THREE.MeshStandardMaterial({ color: 0x12333d, roughness: 0.17, metalness: 0.65 }));
  const amber = registry.material(new THREE.MeshStandardMaterial({ color: 0xffbc63, emissive: 0xffa448, emissiveIntensity: 2.5 }));

  const box = (w: number, h: number, d: number, x: number, y: number, z: number, paint: Material) => {
    const mesh = new THREE.Mesh(registry.geometry(new THREE.BoxGeometry(w, h, d)), paint);
    mesh.position.set(x, y, z);
    vessel.add(mesh);
    return mesh;
  };
  const spar = (from: [number, number, number], to: [number, number, number], radius = 0.025, paint: Material = metal) => {
    const a = new THREE.Vector3(...from), b = new THREE.Vector3(...to);
    const mesh = new THREE.Mesh(registry.geometry(new THREE.CylinderGeometry(radius, radius, a.distanceTo(b), 6)), paint);
    mesh.position.copy(a).add(b).multiplyScalar(0.5);
    mesh.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), b.sub(a).normalize());
    vessel.add(mesh);
  };

  // V-shaped keel, flared gunwales and a pointed bow, rather than a box hull.
  const hullPositions: number[] = [];
  const stations = [[2.1, 0.72], [1.25, 0.95], [-0.65, 0.86], [-1.75, 0.48], [-2.7, 0.035]];
  for (let i = 0; i < stations.length - 1; i++) {
    for (const side of [-1, 1]) {
      const [z, width] = stations[i], [nz, nw] = stations[i + 1];
      const a = [side * width, 0.65, z], b = [side * nw, 0.72, nz];
      const c = [side * width * 0.35, -0.36, z], d = [side * nw * 0.35, -0.36, nz];
      hullPositions.push(...a, ...b, ...c, ...b, ...d, ...c);
      spar([side * width, 0.69, z], [side * nw, 0.76, nz], 0.065, cream);
    }
    // Close the keel: the opening shot looks up at the hull from below.
    const [z, width] = stations[i], [nz, nw] = stations[i + 1];
    const kl = [-width * 0.35, -0.36, z], kr = [width * 0.35, -0.36, z];
    const nl = [-nw * 0.35, -0.36, nz], nr = [nw * 0.35, -0.36, nz];
    hullPositions.push(...kl, ...kr, ...nl, ...kr, ...nr, ...nl);
  }
  const hullGeometry = registry.geometry(new THREE.BufferGeometry());
  hullGeometry.setAttribute("position", new THREE.Float32BufferAttribute(hullPositions, 3));
  hullGeometry.computeVertexNormals();
  navy.side = THREE.DoubleSide;
  vessel.add(new THREE.Mesh(hullGeometry, navy));
  box(1.42, 0.12, 3.45, 0, 0.58, 0.25, wood);
  box(1.42, 0.8, 0.1, 0, 0.24, 2.1, navy);
  box(1.25, 1.15, 1.4, 0, 1.2, -0.6, cream);
  box(1.48, 0.14, 1.65, 0, 1.82, -0.6, mint);
  box(1.04, 0.44, 0.025, 0, 1.43, -1.312, glass);
  box(0.04, 0.48, 0.04, 0, 1.43, -1.34, cream);
  for (const side of [-1, 1]) {
    box(0.025, 0.43, 0.86, side * 0.638, 1.43, -0.68, glass);
    spar([side * 0.79, 0.7, 0.6], [side * 0.79, 1.2, 0.6]);
    spar([side * 0.72, 0.7, 1.8], [side * 0.72, 1.2, 1.8]);
    spar([side * 0.79, 1.2, 0.6], [side * 0.72, 1.2, 1.8]);
  }
  spar([0, 1.8, -0.3], [0, 3.8, -0.3], 0.042);
  spar([-0.9, 3.1, -0.3], [0.9, 3.1, -0.3], 0.03);
  spar([0, 3.6, -0.3], [0.7, 0.85, 1.8], 0.009);
  spar([0, 3.6, -0.3], [-0.7, 0.85, 1.8], 0.009);
  spar([0.65, 0.8, 1.3], [1.6, 2.4, 2.4], 0.023);
  spar([1.6, 2.4, 2.4], [1.6, 0.2, 2.4], 0.008);
  box(0.13, 0.18, 0.13, 0, 3.82, -0.3, amber);
  box(0.12, 0.12, 0.12, 0.75, 1.86, -0.6, amber);
  box(0.6, 0.38, 0.55, -0.3, 0.83, 1.1, mint);
  const buoy = new THREE.Mesh(registry.geometry(new THREE.TorusGeometry(0.22, 0.065, 6, 16)), registry.material(new THREE.MeshStandardMaterial({ color: 0xc98049, roughness: 0.8 })));
  buoy.position.set(0.65, 1.02, -0.55);
  buoy.rotation.y = Math.PI / 2;
  vessel.add(buoy);
  const rubber = registry.material(new THREE.MeshStandardMaterial({ color: 0x15252a, roughness: 0.95 }));
  const fenderGeometry = registry.geometry(new THREE.TorusGeometry(0.18, 0.065, 6, 12));
  for (const side of [-1, 1]) {
    for (const z of [0.2, 1.35]) {
      const fender = new THREE.Mesh(fenderGeometry, rubber);
      fender.position.set(side * 0.87, 0.52, z);
      fender.rotation.y = Math.PI / 2;
      vessel.add(fender);
      spar([side * 0.87, 0.52, z], [side * 0.81, 0.95, z], 0.01, wood);
    }
  }
  const ropeGeometry = registry.geometry(new THREE.TorusGeometry(0.2, 0.022, 5, 18));
  for (let i = 0; i < 4; i++) {
    const rope = new THREE.Mesh(ropeGeometry, wood);
    rope.rotation.x = Math.PI / 2;
    rope.position.set(0.35, 0.68 + i * 0.034, 1.55);
    vessel.add(rope);
  }
  box(0.38, 0.25, 0.48, 0.35, 0.76, 0.65, cream);
  spar([-0.52, 1.94, -1.1], [-0.52, 2.65, -1.1], 0.012);
  return vessel;
}

/** Two quiet headlands that leave the sunrise open; layered for real parallax. */
export function createCoast(THREE: Three, registry: SceneRegistry) {
  const group = new THREE.Group();
  for (let layer = 0; layer < 3; layer++) {
    const coast: number[] = [];
    for (const side of [-1, 1]) {
      for (let i = 0; i < 35; i++) {
        const x = side * (70 + i * 9);
        const nx = side * (79 + i * 9);
        const height = (v: number) => THREE.MathUtils.smoothstep(v, 0, 80) * (1 - THREE.MathUtils.smoothstep(v, 235, 315)) * (3 + Math.sin(v * 0.045 + layer) ** 2 * 8 + Math.sin(v * 0.018 + layer * 2) ** 2 * 20);
        const z = -150 - layer * 65;
        coast.push(x, -3, z, nx, -3, z, x, height(i * 9), z, nx, -3, z, nx, height((i + 1) * 9), z, x, height(i * 9), z);
      }
    }
    const land = registry.geometry(new THREE.BufferGeometry());
    land.setAttribute("position", new THREE.Float32BufferAttribute(coast, 3));
    group.add(new THREE.Mesh(land, registry.material(new THREE.MeshBasicMaterial({ color: 0x233f47, side: THREE.DoubleSide }))));
  }
  return group;
}

export interface Birds { mesh: InstancedMesh; update(time: number, boatX: number, boatZ: number): void }

export function createBirds(THREE: Three, registry: SceneRegistry, count: number): Birds {
  const wing = registry.geometry(new THREE.BufferGeometry());
  wing.setAttribute("position", new THREE.Float32BufferAttribute([
    0, 0, -0.12, -0.85, 0.12, 0.18, -0.3, 0, 0.25,
    0, 0, -0.12, 0.3, 0, 0.25, 0.85, 0.12, 0.18,
  ], 3));
  const mesh = new THREE.InstancedMesh(wing, registry.material(new THREE.MeshBasicMaterial({ color: 0x122831, side: THREE.DoubleSide })), count);
  mesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
  mesh.frustumCulled = false;
  const pose: Object3D = new THREE.Object3D();
  return {
    mesh,
    update(time, boatX, boatZ) {
      for (let i = 0; i < count; i++) {
        const phase = time * 0.14 + i * 1.7;
        pose.position.set(
          boatX - 18 + i * 5 + Math.sin(phase) * 7,
          9 + (i % 3) * 1.7 + Math.sin(phase * 1.4) * 0.65,
          boatZ - 36 - i * 3 + Math.cos(phase) * 4,
        );
        pose.rotation.set(0.08, -0.7 + Math.sin(phase) * 0.3, Math.sin(phase * 1.4) * 0.16);
        pose.scale.setScalar(0.45 + (i % 3) * 0.1);
        pose.updateMatrix();
        mesh.setMatrixAt(i, pose.matrix);
      }
      mesh.instanceMatrix.needsUpdate = true;
    },
  };
}

export interface GodRays { mesh: Mesh; material: ShaderMaterial }

/** An open cone under the surface, additively blended and angularly striped. */
export function createGodRays(THREE: Three, registry: SceneRegistry): GodRays {
  const geometry = registry.geometry(new THREE.CylinderGeometry(3.5, 26, 34, 40, 1, true));
  const material = registry.material(new THREE.ShaderMaterial({
    vertexShader: GODRAY_VERTEX,
    fragmentShader: GODRAY_FRAGMENT,
    uniforms: { uTime: { value: 0 }, uStrength: { value: 0 } },
    transparent: true,
    depthWrite: false,
    side: THREE.DoubleSide,
    blending: THREE.AdditiveBlending,
  }));
  const mesh = new THREE.Mesh(geometry, material);
  mesh.position.y = -17;
  mesh.frustumCulled = false;
  return { mesh, material };
}

export interface Motes { points: InstanceType<Three["Points"]>; material: ShaderMaterial }

/** Suspended particulate underwater, and the slower motes inside the eye. */
export function createMotes(
  THREE: Three,
  registry: SceneRegistry,
  options: { count: number; spread: [number, number, number]; centre?: [number, number, number]; color: number; size: number; drift: number; rise?: number },
): Motes {
  const { count, spread, color, size, drift, rise = 0 } = options;
  const centre = options.centre ?? [0, 0, 0];
  const position = new Float32Array(count * 3);
  const seed = new Float32Array(count);
  const rand = (i: number, salt: number) => {
    const v = Math.sin(i * 19.77 + salt * 53.19) * 43758.5453;
    return v - Math.floor(v);
  };
  for (let i = 0; i < count; i++) {
    position[i * 3] = centre[0] + (rand(i, 1) * 2 - 1) * spread[0];
    position[i * 3 + 1] = centre[1] + (rand(i, 2) * 2 - 1) * spread[1];
    position[i * 3 + 2] = centre[2] + (rand(i, 3) * 2 - 1) * spread[2];
    seed[i] = rand(i, 4);
  }
  const geometry = registry.geometry(new THREE.BufferGeometry());
  geometry.setAttribute("position", new THREE.BufferAttribute(position, 3));
  geometry.setAttribute("aSeed", new THREE.BufferAttribute(seed, 1));
  geometry.boundingSphere = new THREE.Sphere(new THREE.Vector3(...centre), Math.hypot(...spread) + 4);
  const material = registry.material(new THREE.ShaderMaterial({
    vertexShader: MOTE_VERTEX,
    fragmentShader: MOTE_FRAGMENT,
    uniforms: {
      uTime: { value: 0 },
      uSize: { value: size },
      uDrift: { value: drift },
      uRise: { value: rise },
      uSpan: { value: spread[1] * 2 },
      uColor: { value: new THREE.Color(color) },
      uOpacity: { value: 0 },
    },
    transparent: true,
    depthWrite: false,
    blending: THREE.AdditiveBlending,
  }));
  const points = new THREE.Points(geometry, material);
  points.frustumCulled = false;
  return { points, material };
}

export type { Group };
