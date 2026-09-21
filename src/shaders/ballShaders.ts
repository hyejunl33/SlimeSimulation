export const glslNoise = /* glsl */ `
vec4 permute(vec4 x){return mod(((x*34.0)+1.0)*x, 289.0);}
vec4 taylorInvSqrt(vec4 r){return 1.79284291400159 - 0.85373472095314 * r;}

float snoise(vec3 v){ 
  const vec2  C = vec2(1.0/6.0, 1.0/3.0) ;
  const vec4  D = vec4(0.0, 0.5, 1.0, 2.0);
  vec3 i  = floor(v + dot(v, C.yyy) );
  vec3 x0 = v - i + dot(i, C.xxx) ;
  vec3 g = step(x0.yzx, x0.xyz);
  vec3 l = 1.0 - g;
  vec3 i1 = min( g.xyz, l.zxy );
  vec3 i2 = max( g.xyz, l.zxy );
  vec3 x1 = x0 - i1 + 1.0 * C.xxx;
  vec3 x2 = x0 - i2 + 2.0 * C.xxx;
  vec3 x3 = x0 - 1.0 + 3.0 * C.xxx;
  i = mod(i, 289.0 ); 
  vec4 p = permute( permute( permute( i.z + vec4(0.0, i1.z, i2.z, 1.0 )) + i.y + vec4(0.0, i1.y, i2.y, 1.0 )) + i.x + vec4(0.0, i1.x, i2.x, 1.0 ));
  float n_ = 1.0/7.0;
  vec3  ns = n_ * D.wyz - D.xzx;
  vec4 j = p - 49.0 * floor(p * ns.z *ns.z);
  vec4 x_ = floor(j * ns.z);
  vec4 y_ = floor(j - 7.0 * x_ );
  vec4 x = x_ *ns.x + ns.yyyy;
  vec4 y = y_ *ns.x + ns.yyyy;
  vec4 h = 1.0 - abs(x) - abs(y);
  vec4 b0 = vec4( x.xy, y.xy );
  vec4 b1 = vec4( x.zw, y.zw );
  vec4 s0 = floor(b0)*2.0 + 1.0;
  vec4 s1 = floor(b1)*2.0 + 1.0;
  vec4 sh = -step(h, vec4(0.0));
  vec4 a0 = b0.xzyw + s0.xzyw*sh.xxyy ;
  vec4 a1 = b1.xzyw + s1.xzyw*sh.zzww ;
  vec3 p0 = vec3(a0.xy,h.x);
  vec3 p1 = vec3(a0.zw,h.y);
  vec3 p2 = vec3(a1.xy,h.z);
  vec3 p3 = vec3(a1.zw,h.w);
  vec4 norm = taylorInvSqrt(vec4(dot(p0,p0), dot(p1,p1), dot(p2, p2), dot(p3,p3)));
  p0 *= norm.x; p1 *= norm.y; p2 *= norm.z; p3 *= norm.w;
  vec4 m = max(0.6 - vec4(dot(x0,x0), dot(x1,x1), dot(x2,x2), dot(x3,x3)), 0.0);
  m = m * m;
  return 42.0 * dot( m*m, vec4( dot(p0,x0), dot(p1,x1), dot(p2,x2), dot(p3,x3) ) );
}

vec3 hash33(vec3 p) {
  p = vec3( dot(p,vec3(127.1,311.7, 74.7)),
            dot(p,vec3(269.5,183.3,246.1)),
            dot(p,vec3(113.5,271.9,124.6)));
  return fract(sin(p)*43758.5453123);
}

float voronoi(vec3 x, out float crack) {
    vec3 p = floor(x);
    vec3 f = fract(x);
    float res = 100.0;
    float res2 = 100.0;
    for(int k=-1; k<=1; k++)
    for(int j=-1; j<=1; j++)
    for(int i=-1; i<=1; i++) {
        vec3 b = vec3(float(i), float(j), float(k));
        vec3 r = vec3(b) - f + hash33(p + b);
        float d = dot(r, r);
        if(d < res) {
            res2 = res; res = d;
        } else if(d < res2) {
            res2 = d;
        }
    }
    crack = res2 - res;
    return res;
}
`;

export const waxVertexShader = /* glsl */ `
${glslNoise}
uniform float uTime;
uniform float uPressure;
varying float vCrack;
varying vec3 vLocalPos;
varying float vFresnel;

void main() {
  vLocalPos = position;
  float crackDist;
  voronoi(position * 4.0 + snoise(position * 2.0)*0.5, crackDist);
  
  float baseCrackWidth = 0.02;
  float activeCrackWidth = baseCrackWidth + uPressure * 0.15; // Global crack opening
  float isCrack = smoothstep(activeCrackWidth, activeCrackWidth - 0.05, crackDist);
  
  // No physical dent needed since we discard the pixels to show holes
  csm_Position = position;
  vCrack = isCrack;
  vec3 viewDirection = normalize(cameraPosition - (modelMatrix * vec4(position, 1.0)).xyz);
  vFresnel = pow(1.0 - max(dot(normal, viewDirection), 0.0), 3.0);
}
`;

export const waxFragmentShader = /* glsl */ `
uniform float uTime;
varying float vCrack;
varying vec3 vLocalPos;
varying float vFresnel;

void main() {
  // Discard pixels where crack value is high (creates holes)
  if (vCrack > 0.5) {
    discard;
  }
  
  vec3 waxColor = vec3(0.9, 0.95, 1.0);
  vec3 iridescent = mix(waxColor, vec3(1.0, 0.8, 0.9), vFresnel);
  
  csm_DiffuseColor = vec4(iridescent, 1.0);
}
`;

export const butterVertexShader = /* glsl */ `
${glslNoise}
uniform float uTime;
uniform float uStretch; // How much it's being pulled
varying vec3 vLocalPos;

void main() {
  vLocalPos = position;
  // Visual wobble that increases when stretched
  float wobble = snoise(position * 2.5 + uTime * 0.6) * (0.02 + uStretch * 0.05);
  csm_Position = position + normal * wobble;
}
`;

export const butterFragmentShader = /* glsl */ `
uniform float uTime;
varying vec3 vLocalPos;

void main() {
  vec3 pink = vec3(1.0, 0.6, 0.75);
  vec3 yellow = vec3(1.0, 0.9, 0.5);
  vec3 mint = vec3(0.6, 1.0, 0.8);
  float n1 = sin(vLocalPos.x * 3.0 + uTime * 1.5) * 0.5 + 0.5;
  float n2 = cos(vLocalPos.y * 3.0 - uTime * 1.2) * 0.5 + 0.5;
  vec3 col = mix(pink, yellow, n1);
  col = mix(col, mint, n2);
  csm_DiffuseColor = vec4(col, 1.0);
}
`;
