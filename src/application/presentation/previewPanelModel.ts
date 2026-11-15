import type { PreviewStatus } from '../ports/preview';

export function previewLabel(preview?: PreviewStatus): string {
  if (!preview) return 'Aperçu indisponible';
  const displayed = preview.source === null ? 'Sans signal' : `C${preview.source}`;
  const reference = preview.reference === null ? 'Sans écran cible' : `Réf. Écran ${preview.reference} ← ${preview.referenceSource === null ? 'Sans signal' : `C${preview.referenceSource}`}`;
  if (preview.phase === 'off' || preview.phase === 'stopped') return 'Aperçu désactivé\nHors direct';
  if (preview.phase === 'suspended') return `Aperçu suspendu\n${preview.reason}`;
  if (preview.phase === 'preparing') return `Préparation C${preview.requested}…\nAffiché : ${displayed}`;
  if (preview.phase === 'error') return `Erreur aperçu C${preview.requested}\nAffiché : ${displayed}`;
  if (preview.phase === 'testing' && preview.temporary) return `Trajet C${preview.referenceSource} → C${preview.destination} · ${Math.round(preview.progress * 100)} %\nVue temporaire · Écran ${preview.reference}`;
  if (preview.phase === 'testing') return `Test ${preview.referenceSource === null ? 'Sans signal' : `C${preview.referenceSource}`} → ${displayed} · ${Math.round(preview.progress * 100)} %\nRéf. Écran ${preview.reference} · Hors direct`;
  return `Aperçu ${displayed}\n${reference}`;
}
