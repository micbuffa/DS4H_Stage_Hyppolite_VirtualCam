import { VertexBuffer } from '@babylonjs/core/Buffers/buffer';
import { Color3 } from '@babylonjs/core/Maths/math.color';
import { Mesh } from '@babylonjs/core/Meshes/mesh';
import { CreateBox } from '@babylonjs/core/Meshes/Builders/boxBuilder';
import { CreateSphere } from '@babylonjs/core/Meshes/Builders/sphereBuilder';
import type { Scene } from '@babylonjs/core/scene';

const outfits = [
  { top: '#ad4742', skin: '#ce9470', hair: '#33261f', legs: '#384b62' },
  { top: '#e0a950', skin: '#905b41', hair: '#302627', legs: '#303c52' },
  { top: '#448d8e', skin: '#e1b29a', hair: '#50372c', legs: '#34414f' },
  { top: '#635b9c', skin: '#aa7351', hair: '#30272c', legs: '#304459' },
  { top: '#b0b9bb', skin: '#d8a37b', hair: '#685342', legs: '#3d4a61' },
  { top: '#4d769e', skin: '#7d5039', hair: '#2b2527', legs: '#303e50' },
];

/** One colored geometry per outfit and stance, shared by every matching spectator. */
export function createSpectatorTemplate(scene: Scene, style: number): Mesh {
  const outfit = outfits[style];
  const parts: Mesh[] = [];
  const colorPart = (mesh: Mesh, hex: string) => {
    const color = Color3.FromHexString(hex);
    const colors = new Float32Array(mesh.getTotalVertices() * 4);
    for (let i = 0; i < colors.length; i += 4) colors.set([color.r, color.g, color.b, 1], i);
    mesh.setVerticesData(VertexBuffer.ColorKind, colors);
    parts.push(mesh);
  };
  const box = (name: string, width: number, height: number, depth: number, x: number, y: number, z: number, color: string, angle = 0) => {
    const mesh = CreateBox(name, { width, height, depth }, scene);
    mesh.position.set(x, y, z);
    mesh.rotation.z = angle;
    colorPart(mesh, color);
  };
  try {
    box('torso', 0.45, 0.58, 0.28, 0, 1.01, 0, outfit.top);
    box('neck', 0.13, 0.13, 0.13, 0, 1.33, 0, outfit.skin);
    const head = CreateSphere('head', { diameterX: 0.31, diameterY: 0.34, diameterZ: 0.3, segments: 5 }, scene);
    head.position.y = 1.52;
    colorPart(head, outfit.skin);
    box('hair', 0.29, 0.09, 0.27, 0, 1.65, -0.017, outfit.hair);
    for (const side of [-1, 1]) {
      box('trouser', 0.18, 0.66, 0.21, side * 0.115, 0.4, 0, outfit.legs);
      box('shoe', 0.19, 0.11, 0.31, side * 0.115, 0.055, 0.055, '#262c35');
      const raised = style === 1 || (style === 4 && side === 1);
      const angle = side * (raised ? -0.47 : 0.16);
      const shoulderX = side * 0.25;
      const direction = raised ? 1 : -1;
      const armX = (length: number) => shoulderX - Math.sin(angle) * direction * length;
      const armY = (length: number) => 1.2 + Math.cos(angle) * direction * length;
      box('sleeve', 0.15, 0.24, 0.18, armX(0.12), armY(0.12), 0, outfit.top, angle);
      box('forearm', 0.11, 0.3, 0.13, armX(0.37), armY(0.37), 0, outfit.skin, angle);
    }
    const mesh = Mesh.MergeMeshes(parts, true);
    if (!mesh) throw new Error('Impossible de construire un spectateur.');
    mesh.name = `audience-template-${style}`;
    return mesh;
  } finally {
    // MergeMeshes releases the parts on success. Also cover an interrupted assembly.
    for (const part of parts) if (!part.isDisposed()) part.dispose();
  }
}
