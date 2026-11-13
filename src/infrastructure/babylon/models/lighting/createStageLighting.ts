import { SpotLight } from '@babylonjs/core/Lights/spotLight';
import { CreateCylinder } from '@babylonjs/core/Meshes/Builders/cylinderBuilder';
import { Color3 } from '@babylonjs/core/Maths/math.color';
import { Quaternion, Vector3 } from '@babylonjs/core/Maths/math.vector';
import type { Scene } from '@babylonjs/core/scene';
import { spotlightMotion, spotlights } from '../../../../domain/concert/concertMotion';
import { createModelGroup } from '../modelGroup';

export function createStageLighting(scene: Scene) {
  const group = createModelGroup(scene, 'stage-lighting');
  const shell = group.material('shell', '#25313d', true);
  const up = Vector3.Up();
  const target = Vector3.Zero();
  const fixtures = spotlights.map(({ x, rgb }, index) => {
    const position = new Vector3(x, 10.15, 5.1);
    const light = new SpotLight(`stage-spot-${index + 1}`, position, new Vector3(0, -1, 0), 0.85, 1.5, scene);
    light.diffuse = new Color3(...rgb);
    light.specular.setAll(0);
    light.range = 24;
    // Leave the capture screens, spectator materials and editing UI independent of the colored light.
    light.includedOnlyMeshes = scene.meshes.filter((mesh) => mesh.metadata?.theme === 'musicians' || mesh.metadata?.theme === 'instruments' || mesh.name === 'stage-deck');

    const lensMaterial = group.material(`lens-${index}`, '#ffffff', true);
    lensMaterial.emissiveColor = light.diffuse;
    const beamMaterial = group.material(`beam-${index}`, '#000000', true);
    beamMaterial.emissiveColor = light.diffuse;
    beamMaterial.alpha = 0.075;
    beamMaterial.disableDepthWrite = true;

    const make = (name: string, diameterTop: number, diameterBottom: number, height: number) => {
      const mesh = CreateCylinder(`stage-spot-${index + 1}-${name}`, { diameterTop, diameterBottom, height, tessellation: 12 }, scene);
      mesh.parent = group.root;
      mesh.metadata = { category: 'concert', theme: 'lighting' };
      mesh.isPickable = false;
      mesh.rotationQuaternion = Quaternion.Identity();
      return mesh;
    };
    const housing = make('housing', 0.62, 0.52, 0.72);
    housing.material = shell;
    housing.position.copyFrom(position);
    const lens = make('lens', 0.51, 0.51, 0.07);
    lens.material = lensMaterial;
    const beam = make('beam', 2.5, 0.25, 1);
    beam.material = beamMaterial;
    return { light, housing, lens, beam, position };
  });

  const update = (seconds: number) => {
    fixtures.forEach(({ light, housing, lens, beam, position }, index) => {
      const motion = spotlightMotion(seconds, index);
      target.set(motion.x, 1.65, 9.8).subtractInPlace(position);
      const distance = target.length();
      light.direction.copyFrom(target).normalize();
      light.intensity = motion.intensity;
      Quaternion.FromUnitVectorsToRef(up, light.direction, housing.rotationQuaternion!);
      lens.rotationQuaternion!.copyFrom(housing.rotationQuaternion!);
      beam.rotationQuaternion!.copyFrom(housing.rotationQuaternion!);
      light.direction.scaleToRef(0.38, lens.position).addInPlace(position);
      light.direction.scaleToRef(distance / 2 + 0.22, beam.position).addInPlace(position);
      beam.scaling.y = distance - 0.34;
    });
  };
  update(0);
  return {
    fixtures, update,
    dispose() {
      group.dispose();
      fixtures.forEach(({ light }) => light.dispose());
    },
  };
}
