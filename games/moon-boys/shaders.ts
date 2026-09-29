/**
 * GLSL ES 3.00 sources. Three programs: the sky (a gradient that darkens into
 * a star field with altitude, with the sun; a flat studio wall at the reveal),
 * the lit instanced meshes (everything solid, with faces and prints from the
 * atlas, painted props and unlit lamps as materials), and the billboard
 * sprites (flame, smoke, glows, glints, sweat).
 */

const NOISE = `
float hash3(vec3 p) { p = fract(p * 0.3183099 + 0.1); p *= 17.0; return fract(p.x * p.y * p.z * (p.x + p.y + p.z)); }
`;

export const LIT_VS = `#version 300 es
precision highp float;
in vec3 aPosition;
in vec3 aNormal;
in vec3 aColor;
in vec4 aExtra;
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
out vec4 vExtra;
out vec4 vTint;
out vec4 vParams;
out vec4 vMore;
void main() {
  vec3 p = aPosition;
  vec3 n = aNormal;
  if (iParams.z > 0.0) {
    // A flag: waves along u, away from its pole.
    float w = aExtra.x;
    p.z += sin(w * 6.0 - uTime * 7.0 + iParams.w) * iParams.z * w * w;
    p.y -= 0.1 * iParams.z * w * w;
  }
  mat4 m = mat4(iM0, iM1, iM2, iM3);
  vec3 s2 = vec3(dot(iM0.xyz, iM0.xyz), dot(iM1.xyz, iM1.xyz), dot(iM2.xyz, iM2.xyz));
  vec4 world = m * vec4(p, 1.0);
  vWorld = world.xyz;
  vNormal = normalize(mat3(m) * (n / s2));
  vColor = aColor;
  vExtra = aExtra;
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
in vec4 vExtra;
in vec4 vTint;
in vec4 vParams;
in vec4 vMore;
uniform vec3 uCamera;
uniform vec3 uFogColor;
uniform float uFogDensity;
uniform vec3 uSunDir;
uniform vec3 uSunColor;
uniform vec3 uAmbientTop;
uniform vec3 uAmbientBottom;
uniform vec3 uPointPos;
uniform vec3 uPointColor;
uniform float uFlash;
uniform sampler2D uAtlas;
out vec4 outColor;
void main() {
  vec3 N = normalize(vNormal);
  if (!gl_FrontFacing) N = -N;
  vec3 V = normalize(uCamera - vWorld);
  vec3 base = vColor * vTint.rgb;
  float part = vExtra.z;
  float alpha = vTint.a;
  if (part > 0.5 && part < 2.5) {
    // A face takes its cell from the instance; a print from its vertices, or the instance when they carry none.
    // Rounded: interpolation can leave a whole-number varying a hair short, which mod would read as the column before.
    float code = floor((part < 1.5 ? vParams.x : (vExtra.w > 0.5 ? vExtra.w : vMore.y)) + 0.5);
    float span = floor(code / 100.0) + 1.0;
    float cell = mod(code, 100.0);
    vec2 uv = vec2((mod(cell, 8.0) + vExtra.x * span) / 8.0, (floor(cell / 8.0) + vExtra.y * span) / 4.0);
    vec4 t = texture(uAtlas, uv);
    base = mix(base, t.rgb, t.a);
    if (vMore.z > 0.5) alpha *= t.a;
  }
  int material = int(vMore.x + 0.5);
  vec3 L = normalize(uSunDir);
  float diff = max(0.0, dot(N, L));
  vec3 ambient = mix(uAmbientBottom, uAmbientTop, N.y * 0.5 + 0.5);
  vec3 toP = uPointPos - vWorld;
  float dP = max(0.001, length(toP));
  float pointDiff = max(0.0, dot(N, toP / dP)) / (1.0 + 0.03 * dP * dP);
  float glossy = (part > 2.5 || material == 3) ? 1.0 : 0.0;
  float spec = pow(max(0.0, dot(N, normalize(L + V))), mix(28.0, 100.0, glossy)) * mix(0.22, 0.9, glossy);
  vec3 col = base * (ambient + uSunColor * diff + uPointColor * pointDiff) + spec * uSunColor * (0.3 + 0.7 * diff);
  if (material == 1) col = base * (0.86 + 0.14 * (diff * 0.5 + 0.5)) + uPointColor * pointDiff * base * 0.5;
  else if (material == 2) col = base;
  col += base * vParams.y;
  float fog = 1.0 - exp(-uFogDensity * length(uCamera - vWorld));
  col = mix(col, uFogColor, fog);
  outColor = vec4(col + uFlash, alpha);
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
  else if (vShape < 2.5) a = pow(max(0.0, 1.0 - r), 2.2);
  else a = smoothstep(1.0, 0.7, r);
  a *= vColor.a;
  outColor = vec4(vColor.rgb * a, a);
}
`;

export const SKY_VS = `#version 300 es
out vec2 vUv;
void main() {
  vec2 p = vec2(float((gl_VertexID << 1) & 2), float(gl_VertexID & 2));
  vUv = p;
  gl_Position = vec4(p * 2.0 - 1.0, 0.9999, 1.0);
}
`;

export const SKY_FS = `#version 300 es
precision highp float;
in vec2 vUv;
uniform vec3 uRight;
uniform vec3 uUp;
uniform vec3 uForward;
uniform float uTanHalf;
uniform float uAspect;
uniform float uSpace;
uniform vec3 uSunDir;
uniform float uTime;
uniform float uStudio;
uniform float uFlash;
out vec4 outColor;
${NOISE}
void main() {
  vec2 ndc = vUv * 2.0 - 1.0;
  vec3 d = normalize(uForward + uRight * ndc.x * uTanHalf * uAspect + uUp * ndc.y * uTanHalf);
  float h = clamp(d.y, -1.0, 1.0);
  vec3 zenith = mix(vec3(0.2, 0.46, 0.92), vec3(0.01, 0.01, 0.03), uSpace);
  vec3 horizon = mix(vec3(0.74, 0.84, 0.97), vec3(0.05, 0.06, 0.13), uSpace);
  vec3 ground = mix(vec3(0.46, 0.58, 0.76), vec3(0.02, 0.02, 0.04), uSpace);
  vec3 col = h >= 0.0 ? mix(horizon, zenith, pow(h, 0.55)) : mix(horizon, ground, pow(-h, 0.5));
  vec3 p = d * 90.0;
  vec3 i = floor(p);
  vec3 f = fract(p) - 0.5;
  float hs = hash3(i);
  float star = smoothstep(0.972, 1.0, hs) * smoothstep(0.34, 0.0, length(f));
  star *= 0.55 + 0.45 * sin(uTime * (1.5 + 5.0 * hash3(i + 3.7)) + hs * 30.0);
  col += vec3(star) * uSpace;
  float s = max(0.0, dot(d, normalize(uSunDir)));
  col += vec3(1.0, 0.95, 0.8) * (pow(s, 900.0) * 3.0 + pow(s, 14.0) * 0.16 * (1.0 - 0.6 * uSpace));
  vec3 studio = mix(vec3(0.17, 0.16, 0.18), vec3(0.06, 0.06, 0.07), clamp(-h * 2.0 + 0.6, 0.0, 1.0));
  col = mix(col, studio, uStudio);
  outColor = vec4(col + uFlash, 1.0);
}
`;
