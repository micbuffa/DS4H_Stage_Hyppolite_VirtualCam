import { parseDocument, serializeDocument } from '../../domain/decors/decorDocument';
import type { DecorDocument } from '../../domain/decors/decorDocument';
export const decorStorageKey = 'aya-decors-v1';
export function saveDecor(storage: Pick<Storage, 'setItem'>, document: DecorDocument): void {
  storage.setItem(decorStorageKey, serializeDocument(document));
}
export function loadDecor(storage: Pick<Storage, 'getItem'>): DecorDocument {
  const json = storage.getItem(decorStorageKey);
  if (!json) throw new Error('Aucune sauvegarde locale. Utilisez d’abord Enregistrer.');
  return parseDocument(json);
}
