import { gridTransitionFunctions } from './gridTransitionShaders';
import { graphicTransitionFunctions } from './graphicTransitionShaders';
// Local procedural shaders; Babylon's registered helpers define color conversions.
export const transitionVertex = `
precision highp float;
attribute vec3 position;
attribute vec2 uv;
uniform mat4 worldViewProjection;
varying vec2 vUV;
void main() { vUV = uv; gl_Position = worldViewProjection * vec4(position, 1.0); }
`;

export const transitionFragment = `
precision highp float;
varying vec2 vUV;
uniform sampler2D sourceA;
uniform sampler2D sourceB;
uniform float progress;
uniform float effectMode;
uniform float wipeDirection;
#include<helperFunctions>
${gridTransitionFunctions}
${graphicTransitionFunctions}
void main() {
  vec4 a = texture2D(sourceA, vUV);
  vec4 b = texture2D(sourceB, vUV);
  if (progress <= 0.0) { gl_FragColor = a; return; }
  if (progress >= 1.0) { gl_FragColor = b; return; }
  if (effectMode > 5.5) { gl_FragColor = graphicTransition(vUV); return; }
  if (effectMode > 2.5) { gl_FragColor = gridTransition(vUV); return; }
  if (effectMode > 1.5) {
    float coordinate = vUV.x;
    if (wipeDirection > 0.5 && wipeDirection < 1.5) coordinate = 1.0 - vUV.x;
    if (wipeDirection > 1.5 && wipeDirection < 2.5) coordinate = 1.0 - vUV.y;
    if (wipeDirection > 2.5) coordinate = vUV.y;
    gl_FragColor = coordinate < progress ? b : a;
    return;
  }
  float wa = 1.0 - progress;
  float wb = progress;
  if (effectMode > 0.5) {
    wa = max(0.0, 1.0 - 2.0 * progress);
    wb = max(0.0, 2.0 * progress - 1.0);
  }
  vec3 linearColor = wa * toLinearSpace(a.rgb) + wb * toLinearSpace(b.rgb);
  gl_FragColor = vec4(toGammaSpace(linearColor), 1.0);
}
`;
