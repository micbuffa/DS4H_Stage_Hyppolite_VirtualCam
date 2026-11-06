import type { StageDefinition } from './concertLayout';
import { drumRiserLayout } from './concertLayout';

export type MusicianRole = 'singer' | 'guitarist' | 'bassist' | 'drummer';
export type InstrumentKind = 'microphone' | 'guitar' | 'bass' | 'drums';
export type Point3 = readonly [number, number, number];
export interface MusicianDefinition {
  role: MusicianRole;
  instrument: InstrumentKind;
  position: Point3;
  yaw: number;
}
const instruments: Record<MusicianRole, InstrumentKind> = {
  singer: 'microphone', guitarist: 'guitar', bassist: 'bass', drummer: 'drums',
};

export function createBandLayout(stage: StageDefinition): MusicianDefinition[] {
  const front = stage.centerZ - stage.depth / 2;
  const riser = drumRiserLayout(stage);
  const definitions: MusicianDefinition[] = [
    { role: 'singer', instrument: 'microphone', position: [0, stage.height, front + 2.2], yaw: 0 },
    { role: 'guitarist', instrument: 'guitar', position: [-5, stage.height, front + 3.5], yaw: -0.12 },
    { role: 'bassist', instrument: 'bass', position: [5, stage.height, front + 3.5], yaw: 0.12 },
    { role: 'drummer', instrument: 'drums', position: [0, stage.height + riser.height, riser.centerZ + 0.6], yaw: 0 },
  ];
  validateBandLayout(definitions, stage);
  return definitions;
}

export function validateBandLayout(definitions: readonly MusicianDefinition[], stage: StageDefinition): void {
  if (definitions.length !== 4 || new Set(definitions.map((definition) => definition.role)).size !== 4) {
    throw new Error('Quatre rôles distincts sont requis.');
  }
  for (const definition of definitions) {
    const { role, instrument, position, yaw } = definition;
    if (!Object.hasOwn(instruments, role) || instruments[role] !== instrument) throw new Error('Association musicien/instrument invalide.');
    if (position.length !== 3 || ![...position, yaw].every(Number.isFinite)) throw new Error('Pose de musicien invalide.');
    const [x, y, z] = position;
    const riser = drumRiserLayout(stage);
    const onRiser = role === 'drummer';
    const expectedY = stage.height + (onRiser ? riser.height : 0);
    const halfWidth = onRiser ? riser.width / 2 : stage.width / 2;
    const centerZ = onRiser ? riser.centerZ : stage.centerZ;
    const halfDepth = (onRiser ? riser.depth : stage.depth) / 2;
    if (Math.abs(y - expectedY) > 0.001 || Math.abs(x) > halfWidth - 0.8 || Math.abs(z - centerZ) > halfDepth - 0.5) {
      throw new Error('Le musicien doit reposer sur son plateau.');
    }
  }
}

export function worldAnchor(definition: MusicianDefinition, local: Point3): Point3 {
  const [x, y, z] = local;
  const [px, py, pz] = definition.position;
  return [px + x * Math.cos(definition.yaw) + z * Math.sin(definition.yaw), py + y, pz - x * Math.sin(definition.yaw) + z * Math.cos(definition.yaw)];
}

export function musicianAnchors(role: MusicianRole) {
  const seated = role === 'drummer';
  const fretted = role === 'guitarist' || role === 'bassist';
  return {
    hip: [0, seated ? 0.58 : 0.94, 0] as Point3,
    head: [0, seated ? 1.5 : 1.87, 0] as Point3,
    shoulders: [[-0.3, seated ? 1.17 : 1.54, 0], [0.3, seated ? 1.17 : 1.54, 0]] as readonly Point3[],
    elbows: [[-0.47, seated ? 1.03 : 1.23, -0.22], [0.48, seated ? 1.04 : 1.22, -0.16]] as readonly Point3[],
    hands: [
      [-0.2, seated ? 1.33 : fretted ? 1.05 : 1.38, seated ? -0.55 : -0.45],
      [fretted ? 0.5 : 0.24, seated ? 1.34 : fretted ? 1.6 : 1.69, seated ? -0.55 : -0.45],
    ] as readonly Point3[],
    instrument: [0, 0, 0] as Point3,
  };
}
