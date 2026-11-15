import type { RoutingDirector } from '../../../application/commands/routingDirector';

export function attachFeedQuality(document: Document, setQuality: (profile: string) => Promise<void>, director?: RoutingDirector) {
  const select = document.querySelector<HTMLSelectElement>('#feed-quality');
  const status = document.getElementById('quality-status');
  if (!select || !status) return () => undefined;
  let active = true;
  let quality = 'standard';
  let applying = false;
  const refresh = () => {
    const busy = director?.snapshot().pending !== undefined && director.snapshot().pending !== null;
    select.disabled = applying || !!busy;
    select.title = busy ? 'Attendre la fin du passage avant de changer la qualité.' : '';
    if (!applying && busy) status.textContent = select.title;
    else if (!applying && status.textContent === 'Attendre la fin du passage avant de changer la qualité.') status.textContent = 'Qualité vidéo disponible.';
  };
  const detach = director?.subscribe(refresh);
  const update = async () => {
    const next = select.value;
    applying = true; refresh();
    status.textContent = 'Préparation de la qualité vidéo…';
    try {
      await setQuality(next);
      quality = next;
      if (active) status.textContent = 'Qualité vidéo appliquée.';
    } catch (error) {
      if (active) status.textContent = error instanceof Error ? error.message : 'Qualité vidéo indisponible.';
    } finally {
      if (active) {
        select.value = quality;
        applying = false; refresh();
      }
    }
  };
  select.addEventListener('change', update);
  return () => {
    active = false;
    detach?.();
    select.removeEventListener('change', update);
  };
}
