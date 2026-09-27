/**
 * GLSL ES 3.00 sources. Four programs: the tunnel wall (a grid bent onto the
 * path), the lit instanced meshes (swimmers, whale, egg, latex, glass), the
 * billboard sprites (motes, glows, streaks) and a backdrop gradient for the
 * view from outside.
 */
import { PATH_GLSL } from './path';

const NOISE = `
float hash3(vec3 p) { p = fract(p * 0.3183099 + 0.1); p *= 17.0; return fract(p.x * p.y * p.z * (p.x + p.y + p.z)); }
float noise3(vec3 x) {
  vec3 i = floor(x);
  vec3 f = fract(x);
  f = f * f * (3.0 - 2.0 * f);
  return mix(mix(mix(hash3(i), hash3(i + vec3(1, 0, 0)), f.x), mix(hash3(i + vec3(0, 1, 0)), hash3(i + vec3(1, 1, 0)), f.x), f.y),
             mix(mix(hash3(i + vec3(0, 0, 1)), hash3(i + vec3(1, 0, 1)), f.x), mix(hash3(i + vec3(0, 1, 1)), hash3(i + vec3(1, 1, 1)), f.x), f.y), f.z);
}
`;

export const TUNNEL_VS = `#version 300 es
precision highp float;
in vec2 aGrid;
uniform mat4 uViewProj;
uniform float uS0;
uniform float uSpacing;
uniform float uPulse;
uniform float uBeat;
uniform float uBulgeS;
uniform float uBulge;
out vec3 vWorld;
out vec3 vNormal;
out float vS;
out vec2 vRing;
${PATH_GLSL}
float wallRadius(float th, float s) {
  float r = tunnelRadius(s);
  r *= 1.0 + 0.055 * sin(6.0 * th + 0.13 * s) + 0.035 * sin(11.0 * th - 0.21 * s + 1.7);
  r += 0.32 * sin(0.85 * s + 2.0 * th);
  float wave = pow(max(0.0, sin(uBeat - s * 0.045)), 6.0);
  r *= 1.0 - uPulse * 0.07 * wave;
  r += uBulge * 7.0 * exp(-pow((s - uBulgeS) / 26.0, 2.0));
  return r;
}
vec3 wallPoint(float th, float s) {
  vec3 t = pathTangent(s);
  vec3 side = normalize(cross(vec3(0.0, 1.0, 0.0), t));
  vec3 up = cross(t, side);
  return pathPoint(s) + wallRadius(th, s) * (cos(th) * side + sin(th) * up);
}
void main() {
  float th = aGrid.x * 6.28318530718;
  float s = uS0 + aGrid.y * uSpacing;
  vec3 p = wallPoint(th, s);
  vec3 n = normalize(cross(wallPoint(th + 0.02, s) - p, wallPoint(th, s + 0.08) - p));
  if (dot(n, pathPoint(s) - p) < 0.0) n = -n;
  vWorld = p;
  vNormal = n;
  vS = s;
  vRing = vec2(cos(th), sin(th));
  gl_Position = uViewProj * vec4(p, 1.0);
}
`;

export const TUNNEL_FS = `#version 300 es
precision highp float;
in vec3 vWorld;
in vec3 vNormal;
in float vS;
in vec2 vRing;
uniform vec3 uCamera;
uniform vec3 uFogColor;
uniform vec3 uFogGlow;
uniform float uFogDensity;
uniform vec3 uGlowPos;
uniform vec3 uGlowColor;
uniform float uPulse;
uniform float uBeat;
uniform float uFlash;
uniform float uHeat;
out vec4 outColor;
${NOISE}
void main() {
  vec3 N = normalize(vNormal);
  vec3 V = normalize(uCamera - vWorld);
  vec3 q = vec3(vRing * 2.2, vS * 0.18);
  float n1 = noise3(q * 1.3);
  float n2 = noise3(q * 3.1 + 7.0);
  float vein = pow(1.0 - abs(noise3(q * vec3(1.6, 1.6, 0.9) + 3.0) * 2.0 - 1.0), 10.0);
  vec3 flesh = mix(vec3(0.62, 0.1, 0.2), vec3(0.98, 0.45, 0.55), n1);
  flesh = mix(flesh, vec3(1.0, 0.74, 0.74), smoothstep(0.62, 0.9, n2) * 0.35);
  flesh = mix(flesh, vec3(0.42, 0.03, 0.16), vein * 0.75);
  float dist = length(uCamera - vWorld);
  float diff = max(0.0, dot(N, V)) * 0.7 + 0.3;
  float att = 1.25 / (1.0 + 0.0045 * dist * dist);
  vec3 toGlow = uGlowPos - vWorld;
  float glow = max(0.0, dot(N, normalize(toGlow))) / (1.0 + 0.00006 * dot(toGlow, toGlow));
  float spec = pow(max(0.0, dot(N, V)), 70.0) * (0.2 + 0.5 * n2);
  float rim = pow(1.0 - max(0.0, dot(N, V)), 3.0);
  float wave = pow(max(0.0, sin(uBeat - vS * 0.045)), 6.0) * uPulse;
  vec3 col = flesh * (0.12 + diff * att) + flesh * glow * uGlowColor * 0.9 + spec * att * vec3(1.0, 0.86, 0.9) + rim * vec3(0.9, 0.25, 0.4) * 0.3;
  col += vec3(0.5, 0.05, 0.12) * wave * 0.35;
  col = mix(col, col * vec3(1.15, 0.8, 0.8), uHeat);
  float halo = pow(max(0.0, dot(-V, normalize(uGlowPos - uCamera))), 10.0);
  col = mix(col, mix(uFogColor, uFogGlow, halo), 1.0 - exp(-uFogDensity * dist));
  outColor = vec4(col + uFlash, 1.0);
}
`;

export const LIT_VS = `#version 300 es
precision highp float;
in vec3 aPosition;
in vec3 aNormal;
in vec3 aColor;
in vec2 aExtra;
in vec4 iM0;
in vec4 iM1;
in vec4 iM2;
in vec4 iM3;
in vec4 iTint;
in vec4 iParams;
in vec4 iMore;
uniform mat4 uViewProj;
uniform float uTime;
out vec3 vWorld;
out vec3 vNormal;
out vec3 vColor;
out vec3 vLocal;
out float vPart;
out vec4 vTint;
out vec4 vParams;
out vec4 vMore;
void main() {
  vec3 p = aPosition;
  vec3 n = aNormal;
  float w = aExtra.x;
  if (iParams.y > 0.0) {
    if (iMore.y < 0.5) {
      p.x += sin(w * 11.0 - iParams.x) * iParams.y * w;
      if (w == 0.0) {
        float yaw = sin(iParams.x) * iParams.y * 0.3;
        mat2 r = mat2(cos(yaw), -sin(yaw), sin(yaw), cos(yaw));
        p.xz = r * p.xz;
        n.xz = r * n.xz;
      }
    } else {
      p.y += sin(w * 3.2 - iParams.x) * iParams.y * w * w;
    }
  }
  if (iMore.z > 0.0) {
    float wob = sin(p.x * 5.0 + uTime * 3.1) * sin(p.y * 4.0 + uTime * 2.3) * sin(p.z * 4.5 + uTime * 2.7);
    p += n * wob * iMore.z;
  }
  mat4 m = mat4(iM0, iM1, iM2, iM3);
  vec3 s2 = vec3(dot(iM0.xyz, iM0.xyz), dot(iM1.xyz, iM1.xyz), dot(iM2.xyz, iM2.xyz));
  vec4 world = m * vec4(p, 1.0);
  vWorld = world.xyz;
  vNormal = normalize(mat3(m) * (n / s2));
  vColor = aColor;
  vLocal = p;
  vPart = aExtra.y;
  vTint = iTint;
  vParams = iParams;
  vMore = iMore;
  gl_Position = uViewProj * world;
}
`;

export const LIT_FS = `#version 300 es
precision highp float;
in vec3 vWorld;
in vec3 vNormal;
in vec3 vColor;
in vec3 vLocal;
in float vPart;
in vec4 vTint;
in vec4 vParams;
in vec4 vMore;
uniform vec3 uCamera;
uniform vec3 uFogColor;
uniform vec3 uFogGlow;
uniform float uFogDensity;
uniform vec3 uLightPos;
uniform vec3 uGlowPos;
uniform vec3 uGlowColor;
uniform vec3 uAmbientTop;
uniform vec3 uAmbientBottom;
uniform sampler2D uAtlas;
out vec4 outColor;
${NOISE}
vec4 face(vec3 local, float cell) {
  vec2 uv = vec2(0.5 + local.x / 0.36, 0.5 - local.y / 0.36);
  if (any(lessThan(uv, vec2(0.0))) || any(greaterThan(uv, vec2(1.0)))) return vec4(0.0);
  return texture(uAtlas, vec2((mod(cell, 4.0) + uv.x) * 0.125, (floor(cell / 4.0) + uv.y) * 0.25));
}
vec4 print(vec3 local, float mode) {
  vec2 uv = mode < 0.5
    ? vec2(0.5 - local.x / 1.7, 0.5 - local.y / 0.85)
    : vec2((local.z - 1.5) / 3.0, 0.5 - atan(local.y, local.x) / 2.2);
  if (any(lessThan(uv, vec2(0.0))) || any(greaterThan(uv, vec2(1.0)))) return vec4(0.0);
  return texture(uAtlas, vec2(0.5 + uv.x * 0.5, uv.y * 0.5));
}
void main() {
  vec3 N = normalize(vNormal);
  if (!gl_FrontFacing) N = -N;
  vec3 V = normalize(uCamera - vWorld);
  vec3 base = vColor * vTint.rgb;
  int material = int(vMore.x + 0.5);
  float printAlpha = 0.0;
  if (vPart > 0.5 && vPart < 1.5 && vParams.z >= 0.0) {
    vec4 f = face(vLocal, vParams.z);
    base = mix(base, f.rgb, f.a * smoothstep(0.08, 0.2, vLocal.z));
  } else if (vPart > 1.5 && vPart < 2.5) {
    vec4 p = print(vLocal, vMore.w);
    printAlpha = p.a;
    base = mix(base, p.rgb, p.a);
  }
  float glossy = step(2.5, vPart);
  vec3 L = normalize(uLightPos - vWorld);
  float dist = length(uLightPos - vWorld);
  float att = min(1.0, 1.5 / (1.0 + 0.012 * dist * dist));
  float diff = max(0.0, dot(N, L) * 0.7 + 0.3);
  vec3 toGlow = uGlowPos - vWorld;
  float glow = max(0.0, dot(N, normalize(toGlow)));
  float spec = pow(max(0.0, dot(N, normalize(L + V))), mix(36.0, 110.0, glossy)) * mix(0.45, 1.6, glossy);
  float facing = max(0.0, dot(N, V));
  float rim = pow(1.0 - facing, 2.5);
  vec3 ambient = mix(uAmbientBottom, uAmbientTop, N.y * 0.5 + 0.5);
  vec3 col = base * (ambient + diff * att + glow * uGlowColor * 0.35) + spec * att + rim * uGlowColor * 0.3;
  col += base * vParams.w;
  float alpha = vTint.a;
  float fogScale = 1.0;
  if (material == 1) {
    float maria = smoothstep(0.42, 0.72, noise3(vLocal * 2.4));
    float craters = smoothstep(0.6, 0.8, noise3(vLocal * 6.5 + 3.1));
    vec3 pearl = mix(vec3(1.0, 0.95, 0.9), vec3(0.8, 0.66, 0.72), maria * 0.6);
    pearl = mix(pearl, vec3(0.66, 0.52, 0.6), craters * 0.4);
    col = pearl * (0.4 + 0.55 * pow(facing, 0.4)) + vec3(1.0, 0.7, 0.82) * rim * 0.6;
    fogScale = 0.22;
  } else if (material == 2) {
    float fres = pow(1.0 - abs(dot(N, V)), 3.0);
    col = base * (0.5 + diff * att * 0.5) + spec * att * 1.5 + fres * vec3(1.0, 0.86, 0.92) * 0.7;
    alpha = vTint.a * clamp(0.26 + 0.6 * fres + 0.7 * printAlpha + spec, 0.0, 1.0);
  } else if (material == 4) {
    // Far and big (the whale against the egg): keep the silhouette out of the fog.
    fogScale = 0.35;
  } else if (material == 3) {
    float fres = pow(1.0 - abs(dot(N, V)), 2.0);
    col = mix(base * 0.35, vec3(0.85, 0.95, 1.0), fres) + spec * 2.0;
    alpha = vTint.a * clamp(0.12 + 0.7 * fres + spec, 0.0, 1.0);
  }
  float fog = (1.0 - exp(-uFogDensity * length(uCamera - vWorld))) * fogScale;
  float halo = pow(max(0.0, dot(-V, normalize(uGlowPos - uCamera + vec3(0.0, 0.0, 1e-4)))), 10.0);
  outColor = vec4(mix(col, mix(uFogColor, uFogGlow, halo), fog), alpha);
}
`;

export const SPRITE_VS = `#version 300 es
precision highp float;
in vec2 aCorner;
in vec4 iPosSize;
in vec4 iColor;
in vec4 iVel;
uniform mat4 uView;
uniform mat4 uProj;
uniform float uFogDensity;
out vec2 vUv;
out vec4 vColor;
out float vShape;
void main() {
  vec4 c = uView * vec4(iPosSize.xyz, 1.0);
  vec3 dv = mat3(uView) * iVel.xyz;
  float stretch = length(dv.xy);
  vec2 dir = stretch > 1e-4 ? dv.xy / stretch : vec2(1.0, 0.0);
  vec2 side = vec2(-dir.y, dir.x);
  c.xy += dir * aCorner.x * (iPosSize.w + stretch) + side * aCorner.y * iPosSize.w;
  gl_Position = uProj * c;
  vUv = aCorner;
  vColor = iColor;
  vColor.a *= exp(-uFogDensity * max(0.0, -c.z));
  vShape = iVel.w;
}
`;

export const SPRITE_FS = `#version 300 es
precision highp float;
in vec2 vUv;
in vec4 vColor;
in float vShape;
out vec4 outColor;
void main() {
  float r = length(vUv);
  float a;
  if (vShape < 0.5) a = smoothstep(1.0, 0.25, r);
  else if (vShape < 1.5) a = smoothstep(0.18, 0.0, abs(r - 0.72));
  else a = pow(max(0.0, 1.0 - r), 2.2);
  a *= vColor.a;
  outColor = vec4(vColor.rgb * a, a);
}
`;

export const BACKDROP_VS = `#version 300 es
out vec2 vUv;
void main() {
  vec2 p = vec2(float((gl_VertexID << 1) & 2), float(gl_VertexID & 2));
  vUv = p;
  gl_Position = vec4(p * 2.0 - 1.0, 0.9999, 1.0);
}
`;

export const BACKDROP_FS = `#version 300 es
precision highp float;
in vec2 vUv;
uniform vec3 uTop;
uniform vec3 uBottom;
uniform vec3 uLamp;
uniform vec2 uLampPos;
uniform float uAspect;
out vec4 outColor;
void main() {
  vec3 c = mix(uBottom, uTop, clamp(vUv.y, 0.0, 1.0));
  vec2 d = (vUv - uLampPos) * vec2(uAspect, 1.0);
  c += uLamp * exp(-dot(d, d) * 2.5);
  outColor = vec4(c, 1.0);
}
`;
