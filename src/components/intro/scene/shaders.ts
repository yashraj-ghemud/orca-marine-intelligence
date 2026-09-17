/**
 * ORCA — GLSL for the cinematic intro.
 *
 * Everything the intro renders that is not a plain lit mesh lives here:
 * the Gerstner-ish swell shared by the GPU and the CPU buoyancy, the sky
 * model, the two-sided ocean surface (the camera starts *under* it), the
 * god rays under the surface and the particulate the lens drifts through.
 */

/** Direction x, direction z, frequency, amplitude, speed. Mirrored on the CPU. */
export const WAVES = [
  [0.94, 0.34, 0.38, 0.48, 0.72],
  [-0.45, 0.89, 0.61, 0.25, 0.96],
  [0.71, -0.71, 1.12, 0.12, 1.22],
  [0.24, 0.97, 1.91, 0.055, 1.65],
  [-0.86, 0.51, 3.4, 0.025, 2.1],
] as const;

export const WAVE_GLSL = /* glsl */ `
uniform float uTime;
vec3 swell(vec2 p) {
  vec3 wave = vec3(0.0);
  ${WAVES.map(([x, z, frequency, amplitude, speed]) => `{
    vec2 d = vec2(${x.toFixed(3)}, ${z.toFixed(3)});
    float phase = dot(p, d) * ${frequency.toFixed(3)} - uTime * ${speed.toFixed(3)};
    wave.x += sin(phase) * ${amplitude.toFixed(3)};
    wave.yz += cos(phase) * d * ${(amplitude * frequency).toFixed(5)};
  }`).join("\n")}
  return wave;
}
`;

export const ATMOSPHERE = /* glsl */ `
const vec3 sunDirection = normalize(vec3(0.05, 0.095, -1.0));
vec3 atmosphere(vec3 ray) {
  float elevation = max(ray.y, 0.0);
  vec3 sky = mix(vec3(0.40, 0.51, 0.52), vec3(0.025, 0.085, 0.145), pow(elevation, 0.38));
  float sun = max(dot(ray, sunDirection), 0.0);
  sky += vec3(0.62, 0.28, 0.105) * pow(sun, 12.0) * exp(-elevation * 5.0);
  sky += vec3(1.0, 0.65, 0.32) * pow(sun, 400.0) * 0.38;
  sky += vec3(2.8, 2.05, 1.15) * smoothstep(0.99972, 0.9999, sun);
  return sky;
}
`;

/** Value noise shared by the sky veil and the god rays. */
export const NOISE = /* glsl */ `
float hash(vec2 p) { return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }
float noise(vec2 p) {
  vec2 i = floor(p), f = fract(p);
  f = f * f * (3.0 - 2.0 * f);
  return mix(mix(hash(i), hash(i + vec2(1, 0)), f.x), mix(hash(i + vec2(0, 1)), hash(i + vec2(1, 1)), f.x), f.y);
}
float fbm(vec2 p) { return noise(p) * 0.6 + noise(p * 2.1) * 0.25 + noise(p * 4.2) * 0.15; }
`;

export const WATER_VERTEX = /* glsl */ `
${WAVE_GLSL}
uniform vec2 uBoat;
uniform vec2 uHeading;
uniform vec3 uImpact;
varying vec3 vWorld;
varying vec3 vNormal;
void main() {
  vec3 p = (modelMatrix * vec4(position, 1.0)).xyz;
  vec3 wave = swell(p.xz);
  p.y = wave.x;
  vec2 offset = p.xz - uBoat;
  float aft = -dot(offset, uHeading);
  float beam = dot(offset, vec2(-uHeading.y, uHeading.x));
  float envelope = smoothstep(1.0, 3.0, aft) * (1.0 - smoothstep(12.0, 25.0, aft));
  float ridge = abs(beam) - aft * 0.32;
  float wake = sin(ridge * 5.0) * exp(-ridge * ridge * 1.5) * envelope;
  p.y += wake * 0.09;
  // Breach displacement: uImpact is (x, z, strength). A shark leaving the
  // water pulls a crater up and out, then leaves an expanding ring behind it.
  float toBreach = length(p.xz - uImpact.xy);
  float crater = exp(-toBreach * toBreach * 0.55) * uImpact.z;
  float ring = sin(toBreach * 2.6 - uTime * 3.2) * exp(-toBreach * 0.32) * uImpact.z * 0.35;
  p.y += ring - crater * 0.9;
  vNormal = normalize(vec3(-wave.y, 1.0, -wave.z));
  vWorld = p;
  gl_Position = projectionMatrix * viewMatrix * vec4(p, 1.0);
}
`;

export const WATER_FRAGMENT = /* glsl */ `
uniform float uTime;
uniform vec2 uBoat;
uniform vec2 uHeading;
uniform vec3 uImpact;
varying vec3 vWorld;
varying vec3 vNormal;
${ATMOSPHERE}
${NOISE}

/* Seen from below the surface is a mirror everywhere except Snell's window —
   a bright disc straight overhead through which the sky leaks in. */
vec3 underside(vec3 view, vec3 normal) {
  float up = clamp(abs(dot(normal, view)), 0.0, 1.0);
  // Wider than the physical 48°: the ceiling should glow, not go black.
  float window = smoothstep(0.24, 0.9, up);
  vec3 through = atmosphere(normalize(refract(-view, -normal, 0.752) + vec3(0.0, 0.35, 0.0)));
  vec3 deep = vec3(0.008, 0.052, 0.084);
  vec3 color = mix(deep, through * 1.35, window);
  vec3 halfway = normalize(view + sunDirection);
  color += vec3(0.42, 0.72, 0.68) * pow(max(dot(normal, halfway), 0.0), 55.0) * (0.35 + window) * 1.5;
  // Caustics: the net of light where two drifting noise fields cross.
  vec2 cp = vWorld.xz * 0.85;
  float c1 = fbm(cp + vec2(uTime * 0.23, -uTime * 0.17));
  float c2 = fbm(cp * 1.6 - vec2(uTime * 0.19, uTime * 0.26));
  float caustic = pow(clamp(1.0 - abs(c1 - c2) * 2.4, 0.0, 1.0), 7.0);
  color += vec3(0.18, 0.38, 0.36) * caustic * (0.35 + window);
  return color;
}

void main() {
  vec3 view = normalize(cameraPosition - vWorld);
  float distanceToCamera = length(cameraPosition - vWorld);
  float detail = 1.0 - smoothstep(18.0, 90.0, distanceToCamera);
  vec2 p = vWorld.xz;
  vec2 ripples = vec2(sin(p.x * 12.0 + p.y * 8.0 - uTime * 2.8), cos(p.y * 17.0 - p.x * 6.0 - uTime * 2.2));
  ripples *= sin(p.y * 5.0 + sin(p.x * 4.0) + uTime);
  vec2 offset = p - uBoat;
  float aft = -dot(offset, uHeading);
  float beam = dot(offset, vec2(-uHeading.y, uHeading.x));
  float trail = smoothstep(1.5, 3.0, aft) * (1.0 - smoothstep(10.0, 25.0, aft));
  float ridge = abs(beam) - aft * 0.32;
  float wakeEdge = exp(-ridge * ridge * 4.0) * trail;
  vec2 wakeSlope = vec2(-uHeading.y, uHeading.x) * sign(beam) * cos(ridge * 5.0) * wakeEdge;
  vec3 normal = normalize(vNormal + vec3(ripples.x, 0.0, ripples.y) * 0.032 * detail + vec3(wakeSlope.x, 0.0, wakeSlope.y) * 0.12);

  if (!gl_FrontFacing) {
    vec3 below = underside(view, normal);
    below = mix(below, vec3(0.003, 0.028, 0.05), 1.0 - exp(-distanceToCamera * distanceToCamera * 0.00022));
    gl_FragColor = vec4(below, 1.0);
    #include <tonemapping_fragment>
    #include <colorspace_fragment>
    return;
  }

  float facing = max(dot(normal, view), 0.0);
  float fresnel = 0.025 + 0.975 * pow(1.0 - facing, 5.0);
  vec3 reflection = reflect(-view, normal);
  vec3 deep = vec3(0.008, 0.052, 0.072);
  vec3 teal = vec3(0.035, 0.22, 0.23);
  vec3 water = mix(deep, teal, smoothstep(-0.7, 0.85, vWorld.y) * 0.65);
  water += vec3(0.035, 0.10, 0.09) * pow(max(dot(view, -sunDirection), 0.0), 3.0) * max(vWorld.y, 0.0);
  vec3 color = mix(water, atmosphere(reflection), min(fresnel, 0.88));
  vec3 halfway = normalize(view + sunDirection);
  // Broaden the distant glint instead of letting subpixel ripples shimmer.
  float specular = pow(max(dot(normal, halfway), 0.0), mix(90.0, 220.0, detail));
  color += vec3(1.0, 0.72, 0.38) * specular * 1.65;
  float crest = smoothstep(0.51, 0.81, vWorld.y);
  float flecks = sin(p.x * 7.0 + sin(p.y * 5.0)) * sin(p.y * 11.0 - uTime);
  float foam = crest * smoothstep(0.15, 0.8, flecks) * 0.28 * detail;
  float churn = exp(-beam * beam / max(0.22, aft * 0.06)) * smoothstep(1.8, 2.5, aft) * (1.0 - smoothstep(3.0, 14.0, aft));
  float bubbles = sin(aft * 8.0 + uTime * 3.4 + sin(beam * 12.0));
  float bow = exp(-pow(abs(length(vec2(beam * 1.8, (aft + 2.1) * 1.2)) - 0.7) * 5.0, 2.0));
  foam += wakeEdge * (0.23 + 0.12 * flecks) + churn * (0.25 + 0.13 * bubbles) + bow * 0.2;
  // Foam collar around the impact crater and along its expanding ring.
  float toBreach = length(vWorld.xz - uImpact.xy);
  foam += uImpact.z * (exp(-pow(toBreach - 0.9, 2.0) * 3.0) * 0.85
        + exp(-pow(toBreach - 2.2 - uTime * 0.0, 2.0) * 1.2) * 0.3);
  color = mix(color, vec3(0.65, 0.82, 0.76), clamp(foam, 0.0, 0.62));
  float hullContact = exp(-pow(abs(beam) / 0.85, 4.0) - pow(abs(aft + 0.1) / 2.4, 6.0));
  color *= 1.0 - hullContact * 0.38;
  vec3 fog = atmosphere(normalize(vec3(vWorld.x - cameraPosition.x, 0.015, vWorld.z - cameraPosition.z)));
  color = mix(color, fog, 1.0 - exp(-distanceToCamera * distanceToCamera * 0.000028));
  gl_FragColor = vec4(color, 1.0);
  #include <tonemapping_fragment>
  #include <colorspace_fragment>
}
`;

export const SKY_FRAGMENT = /* glsl */ `
uniform float uUnder;
varying vec3 vDirection;
${ATMOSPHERE}
${NOISE}
void main() {
  vec3 ray = normalize(vDirection);
  vec3 color = atmosphere(ray);
  vec2 p = ray.xz / max(ray.y + 0.22, 0.06) * vec2(1.8, 8.0);
  float veil = smoothstep(0.48, 0.82, fbm(p)) * smoothstep(0.02, 0.16, ray.y) * (1.0 - smoothstep(0.25, 0.65, ray.y));
  color = mix(color, vec3(0.38, 0.46, 0.48), veil * 0.24);
  // Below the waterline the dome becomes the deep: light only from above.
  vec3 abyss = mix(vec3(0.002, 0.014, 0.028), vec3(0.02, 0.12, 0.155), smoothstep(-0.25, 1.0, ray.y));
  gl_FragColor = vec4(mix(color, abyss, uUnder), 1.0);
  #include <tonemapping_fragment>
  #include <colorspace_fragment>
}
`;

/** Volumetric shafts under the surface — additive, angularly striped, soft-tipped. */
export const GODRAY_VERTEX = /* glsl */ `
varying vec2 vUv;
varying vec3 vWorld;
void main() {
  vUv = uv;
  vWorld = (modelMatrix * vec4(position, 1.0)).xyz;
  gl_Position = projectionMatrix * viewMatrix * vec4(vWorld, 1.0);
}
`;

export const GODRAY_FRAGMENT = /* glsl */ `
uniform float uTime;
uniform float uStrength;
varying vec2 vUv;
varying vec3 vWorld;
${NOISE}
void main() {
  // vUv.y runs 0 at the surface to 1 at depth on the cone wall.
  float depth = 1.0 - smoothstep(0.0, 0.92, vUv.y);
  float shafts = fbm(vec2(vUv.x * 26.0, uTime * 0.16)) * 0.65 + fbm(vec2(vUv.x * 61.0 + 9.0, uTime * 0.1)) * 0.35;
  shafts = smoothstep(0.42, 0.95, shafts);
  float edge = sin(vUv.x * 3.14159);
  float alpha = depth * shafts * edge * uStrength;
  vec3 tint = mix(vec3(0.24, 0.62, 0.62), vec3(0.72, 0.92, 0.86), depth);
  gl_FragColor = vec4(tint * alpha, alpha);
}
`;

/** Suspended particulate under the surface. */
export const MOTE_VERTEX = /* glsl */ `
uniform float uTime;
uniform float uSize;
uniform float uDrift;
uniform float uRise;
uniform float uSpan;
attribute float aSeed;
varying float vFade;
void main() {
  vec3 p = position;
  // Bubbles: climb at their own rate and wrap within the column.
  if (uRise > 0.0) p.y += mod(uTime * uRise * (0.6 + aSeed * 0.9) + aSeed * 40.0, uSpan) - uSpan * 0.5;
  p.x += sin(uTime * (0.18 + aSeed * 0.22) + aSeed * 31.0) * uDrift;
  p.y += cos(uTime * (0.13 + aSeed * 0.17) + aSeed * 17.0) * uDrift * 0.7;
  p.z += sin(uTime * (0.11 + aSeed * 0.19) + aSeed * 53.0) * uDrift;
  vec4 view = viewMatrix * vec4(p, 1.0);
  float dist = -view.z;
  vFade = smoothstep(1.4, 5.5, dist) * (1.0 - smoothstep(26.0, 60.0, dist)) * (0.35 + aSeed * 0.65);
  // Capped: without this, motes drifting past the lens read as bokeh discs.
  gl_PointSize = min(uSize * (1.0 + aSeed) * (12.0 / max(dist, 0.35)), 7.0);
  gl_Position = projectionMatrix * view;
}
`;

export const MOTE_FRAGMENT = /* glsl */ `
uniform vec3 uColor;
uniform float uOpacity;
varying float vFade;
void main() {
  float r = length(gl_PointCoord - 0.5);
  if (r > 0.5) discard;
  float alpha = pow(1.0 - r * 2.0, 1.7) * vFade * uOpacity;
  gl_FragColor = vec4(uColor * alpha, alpha);
}
`;

/** The sonar ping that wakes the sunken instruments. */
export const PULSE_VERTEX = /* glsl */ `
varying vec2 vUv;
void main() {
  vUv = uv;
  gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
}
`;

export const PULSE_FRAGMENT = /* glsl */ `
uniform float uProgress;
uniform float uOpacity;
varying vec2 vUv;
void main() {
  float r = length(vUv - 0.5) * 2.0;
  float edge = smoothstep(uProgress - 0.05, uProgress, r) * (1.0 - smoothstep(uProgress, uProgress + 0.14, r));
  float trail = (1.0 - smoothstep(0.0, uProgress, r)) * 0.07;
  float alpha = (edge + trail) * uOpacity * (1.0 - smoothstep(0.88, 1.0, r));
  vec3 tint = mix(vec3(0.16, 0.45, 0.52), vec3(0.75, 0.97, 0.9), edge);
  gl_FragColor = vec4(tint * alpha, alpha);
}
`;

/**
 * Injected into MeshStandardMaterial: the net of caustic light that the
 * swell above throws onto anything in the deep, and the rim that catches on
 * the bevels. Shared by the instrument slabs and the seabed.
 */
export const CAUSTIC_INJECT = {
  pars: /* glsl */ `
    uniform float uCausticTime;
    uniform float uCaustic;
    varying vec3 vCausticWorld;
    ${NOISE}
    float causticNet(vec2 p, float t) {
      float c1 = fbm(p * 0.55 + vec2(t * 0.21, -t * 0.16));
      float c2 = fbm(p * 0.9 - vec2(t * 0.18, t * 0.24));
      return pow(clamp(1.0 - abs(c1 - c2) * 2.3, 0.0, 1.0), 6.0);
    }
  `,
  vertex: /* glsl */ `
    vCausticWorld = (modelMatrix * vec4(position, 1.0)).xyz;
  `,
  fragment: /* glsl */ `
    {
      float net = causticNet(vCausticWorld.xz + vCausticWorld.y * 0.35, uCausticTime);
      diffuseColor.rgb *= 1.0 + net * uCaustic * 1.6;
    }
  `,
};
