export const catalog = {
  screen: 'Écran', speaker: 'Enceinte', tower: 'Pylône', booth: 'Cabine régie', stairs: 'Escalier', lamp: 'Spot',
} as const;
export type DecorKind = keyof typeof catalog;
export type Triple = [number, number, number];
export interface DecorObject {
  id: string; kind: DecorKind; position: Triple; rotation: Triple; scale: Triple;
  color: string; intensity: number; beam: boolean;
}
export interface DecorDocument {
  format: 'aya-decors'; version: 1; preset: 'festival' | 'compact'; floor: 'dark' | 'wood';
  objects: DecorObject[];
}
export function newObject(kind: DecorKind, id: string): DecorObject {
  if (!Object.hasOwn(catalog, kind) || !id) throw new Error('Type ou identifiant de décor invalide.');
  return { id, kind, position: [0, 1.5, 3], rotation: [0, 0, 0], scale: [1, 1, 1],
    color: kind === 'screen' ? '#865bff' : kind === 'lamp' ? '#ff4066' : '#536476', intensity: 3, beam: true };
}
export function validateDocument(value: unknown): DecorDocument {
  if (!value || typeof value !== 'object') throw new Error('Document invalide.');
  const doc = value as DecorDocument;
  if (doc.format !== 'aya-decors' || doc.version !== 1) throw new Error('Format ou version non pris en charge.');
  if (!['festival', 'compact'].includes(doc.preset) || !['dark', 'wood'].includes(doc.floor) ||
      !Array.isArray(doc.objects) || doc.objects.length > 100) throw new Error('Configuration invalide (100 décors maximum).');
  const ids = new Set<string>();
  for (const obj of doc.objects) {
    if (!obj || typeof obj !== 'object' || !Object.hasOwn(catalog, obj.kind) ||
        typeof obj.id !== 'string' || !/^[a-zA-Z0-9_-]{1,80}$/.test(obj.id) || ids.has(obj.id)) throw new Error('Décor inconnu ou identifiant dupliqué.');
    ids.add(obj.id);
    for (const field of ['position', 'rotation', 'scale'] as const) {
      if (!Array.isArray(obj[field]) || obj[field].length !== 3 ||
          !obj[field].every(n => typeof n === 'number' && Number.isFinite(n) && Math.abs(n) <= 100)) throw new Error('Transformation invalide.');
    }
    if (obj.scale.some(n => n < 0.1 || n > 5) || typeof obj.color !== 'string' ||
        !/^#[a-fA-F0-9]{6}$/.test(obj.color) || !Number.isFinite(obj.intensity) ||
        obj.intensity < 0 || obj.intensity > 10 || typeof obj.beam !== 'boolean') throw new Error('Propriétés hors limites.');
  }
  return structuredClone(doc);
}
export function createPreset(preset: DecorDocument['preset']): DecorDocument {
  const objects: DecorObject[] = [];
  const screenXs = preset === 'festival' ? [-17, 17, 0] : [0];
  screenXs.forEach((x, i) => {
    const o = newObject('screen', 'screen-' + i); o.position = [x, 7, x === 0 ? 15.5 : 10]; objects.push(o);
  });
  ['#ff4066', '#48ed9d', '#498aff'].forEach((color, i) => {
    const o = newObject('lamp', 'lamp-' + i); o.position = [(i - 1) * 6, 9.5, 7]; o.color = color; objects.push(o);
  });
  return { format: 'aya-decors', version: 1, preset, floor: 'dark', objects };
}
export function duplicateObject(doc: DecorDocument, id: string, newId: string): DecorDocument {
  const next = validateDocument(doc);
  const original = next.objects.find(o => o.id === id);
  if (!original) throw new Error('Sélectionnez un décor.');
  const copy = structuredClone(original); copy.id = newId; copy.position[0] += 2;
  next.objects.push(copy);
  return validateDocument(next);
}
export function serializeDocument(doc: DecorDocument): string { return JSON.stringify(validateDocument(doc), null, 2); }
export function parseDocument(json: string): DecorDocument {
  if (json.length > 200_000) throw new Error('Fichier trop volumineux.');
  return validateDocument(JSON.parse(json));
}
