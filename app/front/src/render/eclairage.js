// Éclairage partagé par la vue 3D (world.js) et la vue à hauteur d'yeux (ground.js) : terminateur adouci, ombre d'éclipse,
// lumière de la planète, lumières nocturnes, ombres croisées planète/anneau, et maillage d'anneau.
import * as THREE from 'three';

/**
 * Éclairage des corps : terminateur adouci (l'éclairage direct déborde un peu sur la face nuit), et, pour une lune,
 * ombre d'éclipse (uShadow : part du disque de l'étoile encore visible) et lumière de la planète sur la face nuit (uShine, uShineDir).
 */
export function lightMods(mat, wrap, moon = false, ring = null, lights = false) {
  const a = 'float dotNL = saturate( dot( geometryNormal, directLight.direction ) );';
  mat.userData.u = { uShadow: { value: 1 }, uShine: { value: new THREE.Vector3() }, uShineDir: { value: new THREE.Vector3(1, 0, 0) } };
  if (lights) mat.userData.u.uSunDirW = { value: new THREE.Vector3(1, 0, 0) };
  if (ring) Object.assign(mat.userData.u, { uRingTex: { value: ring.tex }, uRingIn: { value: ring.inner }, uRingOut: { value: ring.outer }, uRingK: { value: ring.k }, uRingN: { value: new THREE.Vector3(0, 0, 1) }, uC: { value: new THREE.Vector3() }, uSunW: { value: new THREE.Vector3() }, uRingR: { value: 1 } });
  mat.onBeforeCompile = (sh) => {
    sh.fragmentShader = sh.fragmentShader.replace('#include <lights_physical_pars_fragment>', THREE.ShaderChunk.lights_physical_pars_fragment.replace(a, `float dotNL = saturate( ( dot( geometryNormal, directLight.direction ) + ${wrap.toFixed(2)} ) / ${(1 + wrap).toFixed(2)} );`));
    if (ring) {
      Object.assign(sh.uniforms, mat.userData.u);
      sh.vertexShader = sh.vertexShader.replace('void main() {', 'varying vec3 vWPos;\nvoid main() {').replace('#include <project_vertex>', '#include <project_vertex>\n  vWPos = ( modelMatrix * vec4( transformed, 1.0 ) ).xyz;');
      sh.fragmentShader = sh.fragmentShader.replace('void main() {', 'varying vec3 vWPos; uniform sampler2D uRingTex; uniform float uRingIn; uniform float uRingOut; uniform float uRingK; uniform float uRingR; uniform vec3 uRingN; uniform vec3 uC; uniform vec3 uSunW;\nvoid main() {')
        .replace('#include <lights_fragment_end>', `{ vec3 Ld = normalize( uSunW - vWPos ); float dn = dot( Ld, uRingN );
          if ( abs( dn ) > 1e-3 ) { float tt = dot( uC - vWPos, uRingN ) / dn;
            if ( tt > 0.0 ) { vec3 H = vWPos + Ld * tt; float u = ( length( H - uC ) / uRingR - uRingIn ) / ( uRingOut - uRingIn );
              if ( u > 0.0 && u < 1.0 ) { float sh = 1.0 - texture2D( uRingTex, vec2( u, 0.5 ) ).a * uRingK; reflectedLight.directDiffuse *= sh; reflectedLight.directSpecular *= sh; } } } }
        #include <lights_fragment_end>`);
    }
    if (!moon && !lights) return;
    if (!ring) Object.assign(sh.uniforms, mat.userData.u);
    let f = sh.fragmentShader.replace('void main() {', `uniform float uShadow;${moon ? ' uniform vec3 uShine; uniform vec3 uShineDir;' : ''}${lights ? ' uniform vec3 uSunDirW;' : ''}\nvoid main() {`);
    if (lights) f = f.replace('#include <emissivemap_fragment>', `#include <emissivemap_fragment>
      totalEmissiveRadiance *= max( smoothstep( 0.04, -0.2, dot( normal, normalize( ( viewMatrix * vec4( uSunDirW, 0.0 ) ).xyz ) ) ), 1.0 - uShadow ); // lumières : face nuit, et pendant une éclipse`);
    if (moon) f = f.replace('#include <lights_fragment_end>', `reflectedLight.directDiffuse *= uShadow; reflectedLight.directSpecular *= uShadow;
      { vec3 sd = normalize( ( viewMatrix * vec4( uShineDir, 0.0 ) ).xyz ); reflectedLight.directDiffuse += uShine * max( dot( geometryNormal, sd ), 0.0 ) * diffuseColor.rgb; }
      #include <lights_fragment_end>`);
    sh.fragmentShader = f;
  };
  mat.customProgramCacheKey = () => `eclairage-${wrap}-${moon}-${!!ring}-${lights}`;
}
export const ringVert = /* glsl */ `
#include <common>
#include <logdepthbuf_pars_vertex>
varying vec3 vWPos; varying vec2 vUv;
void main(){
  vUv = uv; vec4 wp = modelMatrix * vec4(position, 1.0); vWPos = wp.xyz;
  gl_Position = projectionMatrix * viewMatrix * wp;
  #include <logdepthbuf_vertex>
}`;
export const ringFrag = /* glsl */ `
#include <common>
#include <logdepthbuf_pars_fragment>
uniform sampler2D uTex; uniform vec3 uSun; uniform vec3 uC; uniform float uR; uniform vec3 uN; uniform float uOpacity;
varying vec3 vWPos; varying vec2 vUv;
void main(){
  #include <logdepthbuf_fragment>
  vec4 t = texture2D(uTex, vec2(vUv.x, 0.5));
  vec3 L = normalize(uSun - vWPos);
  float lit = 0.2 + 0.8 * abs(dot(uN, L)); // l'anneau est translucide : éclairé des deux côtés, plus sombre quand le Soleil rase son plan
  vec3 oc = vWPos - uC; float b = dot(oc, L); float disc = b * b - (dot(oc, oc) - uR * uR);
  float sh = (disc > 0.0 && b < 0.0) ? 1.0 - smoothstep(0.0, 0.05 * uR * uR, disc) : 1.0; // ombre de la planète sur l'anneau
  gl_FragColor = vec4(t.rgb * lit * mix(0.04, 1.0, sh), t.a * uOpacity);
  #include <colorspace_fragment>
}`;

/** Anneau d'un corps : disque dans son plan équatorial (rayons en rayons planétaires), profil radial `tex`, ombres croisées avec la planète. */
export function makeRingMesh(rg, tex) {
  const geo = new THREE.RingGeometry(rg.inner, rg.outer, 192, 1), pos = geo.attributes.position, uv = geo.attributes.uv;
  for (let q = 0; q < pos.count; q++) uv.setXY(q, (Math.hypot(pos.getX(q), pos.getY(q)) - rg.inner) / (rg.outer - rg.inner), 0.5);
  const m = new THREE.Mesh(geo, new THREE.ShaderMaterial({
    vertexShader: ringVert, fragmentShader: ringFrag, transparent: true, depthWrite: false, side: THREE.DoubleSide,
    uniforms: { uTex: { value: tex }, uSun: { value: new THREE.Vector3() }, uC: { value: new THREE.Vector3() }, uR: { value: 1 }, uN: { value: new THREE.Vector3(0, 0, 1) }, uOpacity: { value: rg.opacity } },
  }));
  m.frustumCulled = false;
  return m;
}
