export const glslNoise = /* glsl */ `
// Simplex 3D Noise 
// by Ian McEwan, Ashima Arts
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
  vec4 p = permute( permute( permute( 
             i.z + vec4(0.0, i1.z, i2.z, 1.0 ))
           + i.y + vec4(0.0, i1.y, i2.y, 1.0 )) 
           + i.x + vec4(0.0, i1.x, i2.x, 1.0 ));

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
  p0 *= norm.x;
  p1 *= norm.y;
  p2 *= norm.z;
  p3 *= norm.w;

  vec4 m = max(0.6 - vec4(dot(x0,x0), dot(x1,x1), dot(x2,x2), dot(x3,x3)), 0.0);
  m = m * m;
  return 42.0 * dot( m*m, vec4( dot(p0,x0), dot(p1,x1), 
                                dot(p2,x2), dot(p3,x3) ) );
}
`;

export const waxVertexShader = /* glsl */ `
${glslNoise}

uniform float uTime;
uniform vec3 uPointer;
uniform float uPressure;

varying float vFresnel;
varying vec3 vLocalPos;

void main() {
  vLocalPos = position;

  // Crunchy, high frequency noise for wax surface
  float baseNoise = snoise(position * 3.5 + uTime * 0.2) * 0.05;
  
  // Interaction deformation
  vec3 toPointer = uPointer - position;
  float dist = length(toPointer);
  float pull = smoothstep(1.0, 0.0, dist) * uPressure * 0.5;
  
  vec3 pos = position + normal * baseNoise;
  pos += normalize(toPointer) * pull;
  
  csm_Position = pos;

  vec3 viewDirection = normalize(cameraPosition - (modelMatrix * vec4(pos, 1.0)).xyz);
  vFresnel = pow(1.0 - max(dot(normal, viewDirection), 0.0), 3.0);
}
`;

export const waxFragmentShader = /* glsl */ `
uniform float uTime;
uniform float uPressure;

varying float vFresnel;
varying vec3 vLocalPos;

void main() {
  // Iridescent pastel colors (icy/pink)
  vec3 color1 = vec3(0.9, 0.7, 1.0); // Pastel Purple
  vec3 color2 = vec3(0.6, 0.9, 1.0); // Pastel Cyan
  
  float mixVal = sin(vLocalPos.y * 5.0 + uTime) * 0.5 + 0.5;
  vec3 baseColor = mix(color1, color2, mixVal);
  
  // Add fresnel glow
  vec3 iridescent = mix(baseColor, vec3(1.0, 1.0, 1.0), vFresnel * 0.8);
  
  csm_DiffuseColor = vec4(iridescent, 1.0);
}
`;

export const butterVertexShader = /* glsl */ `
${glslNoise}

uniform float uTime;
uniform vec3 uPointer;
uniform float uPressure;

varying vec3 vLocalPos;

void main() {
  vLocalPos = position;

  // Soft breathing slime
  float wobble = snoise(position * 1.5 + uTime * 0.5) * 0.08;
  vec3 pos = position + normal * wobble;
  
  // Extreme Stretchy Physics for Butter
  vec3 toPointer = uPointer - pos;
  float dist = length(toPointer);
  
  // The closer to the pointer, the more it is pulled
  float pull = smoothstep(1.5, 0.0, dist); 
  
  // Pinching effect: squash perpendicular to the stretch
  vec3 dir = normalize(toPointer + vec3(0.001)); // prevent div by zero
  
  pos += dir * pull * uPressure * 1.2; // Stretch outwards highly
  
  csm_Position = pos;
}
`;

export const butterFragmentShader = /* glsl */ `
uniform float uTime;
varying vec3 vLocalPos;

void main() {
  // Creamy vibrant pastel gradient (Pink, Yellow, Mint)
  vec3 pink = vec3(1.0, 0.6, 0.75);
  vec3 yellow = vec3(1.0, 0.9, 0.5);
  vec3 mint = vec3(0.6, 1.0, 0.8);
  
  float n1 = sin(vLocalPos.x * 2.0 + uTime) * 0.5 + 0.5;
  float n2 = cos(vLocalPos.z * 2.0 - uTime * 0.8) * 0.5 + 0.5;
  
  vec3 col = mix(pink, yellow, n1);
  col = mix(col, mint, n2);
  
  csm_DiffuseColor = vec4(col, 1.0);
}
`;
