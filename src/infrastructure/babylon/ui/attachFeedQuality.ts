export function attachFeedQuality(document: Document, setQuality: (profile: string) => Promise<void>) {
  const select = document.querySelector<HTMLSelectElement>('#feed-quality');
  const status = document.getElementById('quality-status');
  if (!select || !status) return () => undefined;
  let active = true;
  let quality = 'standard';
  const update = async () => {
    const next = select.value;
    select.disabled = true;
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
        select.disabled = false;
      }
    }
  };
  select.addEventListener('change', update);
  return () => {
    active = false;
    select.removeEventListener('change', update);
  };
}
