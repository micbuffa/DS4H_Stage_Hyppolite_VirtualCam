import type { DirectorPanelModel } from '../../../application/presentation/directorPanelModel';

/** Read-only accessibility companion; all direction commands live on the spatial panel. */
export function panelReadout(document: Document, model: DirectorPanelModel): void {
  const preview = document.getElementById('preview-status');
  if (preview) preview.textContent = model.previewLabel.replaceAll('\n', ' · ');
  const selected = document.getElementById('selected-camera');
  if (selected) selected.textContent = model.selected;
  model.routes.forEach((route, index) => { const row = document.getElementById(`route-${index + 1}`); if (row) row.textContent = route; });
  const feed = document.getElementById('feed-status');
  if (feed) feed.textContent = model.routes.join(' · ');
  const message = document.getElementById('panel-message');
  if (message) { message.textContent = model.message.replaceAll('\n', ' · '); message.dataset.state = model.error ? 'error' : 'ready'; }
  const help = document.getElementById('help-text');
  const transition = document.getElementById('transition-status');
  if (transition) transition.textContent = `Transition préparée : ${model.transitionLabel}`;
  if (help) help.hidden = !model.helpVisible;
}
