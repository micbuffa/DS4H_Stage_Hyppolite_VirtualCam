import type { Scene } from '@babylonjs/core/scene';
import { musicianAnchors } from '../../../../domain/concert/bandLayout';
import type { MusicianDefinition, Point3 } from '../../../../domain/concert/bandLayout';
import { createModelGroup } from '../modelGroup';
import { modelGeometry } from '../modelGeometry';
import { createGuitar } from '../instruments/createGuitar';
import { createMicrophone } from '../instruments/createMicrophone';
import { createDrumKit } from '../instruments/createDrumKit';
import { createAmplifier } from '../instruments/createAmplifier';

const wardrobe = { singer: '#c13d4b', guitarist: '#268f9d', bassist: '#cb9743', drummer: '#8d63bb' };

export function createMusician(scene: Scene, definition: MusicianDefinition) {
  const { role } = definition;
  const group = createModelGroup(scene, `musician-${role}`);
  group.root.position.set(...definition.position);
  group.root.rotation.y = definition.yaw;
  const g = modelGeometry(scene, group.root, group.root.name, 'musicians', role);
  const skin = group.material('skin', role === 'bassist' ? '#9b6449' : '#e1ac87');
  const outfit = group.material('outfit', wardrobe[role]);
  outfit.emissiveColor = outfit.diffuseColor.scale(0.1);
  const black = group.material('black', '#20232b');
  const chrome = group.material('chrome', '#a4aab5');
  const ivory = group.material('ivory', '#e5e3d6');
  const wood = group.material('wood', '#bd8951');
  const accent = group.material('instrument', role === 'bassist' ? '#c48a36' : '#b62c36');
  const gold = group.material('gold', '#d6ab51');
  const hair = group.material('hair', role === 'guitarist' ? '#c18b49' : '#27202b');
  const materials = { black, chrome, ivory, wood, accent, gold };
  const anchors = musicianAnchors(role);
  const seated = role === 'drummer';
  const torsoY = seated ? 0.94 : 1.32;
  g.box('torso', [0.57, 0.52, 0.3], [0, torsoY, 0], outfit);
  g.box('shirt', [0.18, 0.4, 0.02], [0, torsoY, -0.16], black);
  g.box('belt', [0.47, 0.07, 0.32], [0, anchors.hip[1] + 0.06, 0], chrome);
  g.box('pelvis', [0.45, 0.21, 0.29], anchors.hip, black);
  g.rod('neck', [0, torsoY + 0.2, 0], [0, anchors.head[1] - 0.1, 0], 0.15, skin);
  g.sphere('head', [0.4, 0.45, 0.36], anchors.head, skin);
  const headY = anchors.head[1];
  g.sphere('hair-cap', [0.43, 0.24, 0.38], [0, headY + 0.16, 0.02], hair);
  if (role === 'guitarist') {
    for (const x of [-0.18, 0.18]) g.box(`hair-side-${x}`, [0.12, 0.46, 0.28], [x, headY - 0.05, 0.09], hair);
  }
  if (role === 'singer') g.box('mohawk', [0.1, 0.21, 0.32], [0, headY + 0.29, 0], hair);
  for (const x of [-0.085, 0.085]) g.box(`eye-${x}`, [0.055, 0.04, 0.025], [x, headY + 0.025, -0.176], black);
  g.sphere('nose', [0.07, 0.09, 0.1], [0, headY - 0.035, -0.19], skin);
  for (let i = 0; i < 2; i++) {
    const sign = i ? 1 : -1;
    const hip: Point3 = [sign * 0.15, anchors.hip[1], 0];
    const knee: Point3 = [sign * 0.21, seated ? 0.35 : 0.5, seated ? -0.3 : 0];
    const ankle: Point3 = [sign * 0.24, 0.12, seated ? -0.48 : -0.04];
    g.rod(`thigh-${i}`, hip, knee, 0.2, black);
    g.rod(`shin-${i}`, knee, ankle, 0.16, black);
    g.box(`boot-${i}`, [0.23, 0.16, 0.38], [ankle[0], 0.08, ankle[2] - 0.08], black);
    g.sphere(`shoulder-${i}`, [0.23, 0.23, 0.25], anchors.shoulders[i], outfit);
    g.rod(`upper-arm-${i}`, anchors.shoulders[i], anchors.elbows[i], 0.14, skin);
    g.rod(`forearm-${i}`, anchors.elbows[i], anchors.hands[i], 0.12, skin);
    g.sphere(`hand-${i}`, [0.14, 0.14, 0.14], anchors.hands[i], skin);
  }
  let instrument;
  if (role === 'drummer') {
    instrument = createDrumKit(scene, group.root, materials);
    anchors.hands.forEach((hand, i) => g.rod(`drumstick-${i}`, hand, [hand[0] + (i ? 0.22 : -0.24), 1.26, -0.86], 0.018, wood));
  } else if (role === 'singer') {
    instrument = createMicrophone(scene, group.root, materials);
  } else {
    instrument = createGuitar(scene, group.root, materials, role === 'bassist');
    g.rod('strap', [-0.26, 1.55, 0.05], [0.12, 0.95, -0.29], 0.06, black);
    createAmplifier(scene, group.root, materials);
    const microphone = createMicrophone(scene, group.root, materials);
    microphone.position.x = -1;
  }
  return { ...group, definition, anchors, instrument };
}
