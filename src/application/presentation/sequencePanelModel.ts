import type { DirectorSnapshot } from '../commands/routingDirector';
import { planTransition } from '../../domain/direction/transitionPlan';
import { transitionSettings } from '../../domain/direction/transitionDefinition';

export function sequencePanelModel(direction: DirectorSnapshot) {
  const settings = direction.settings ?? transitionSettings();
  const planned = direction.targets.length ? planTransition(direction.routes, direction.selectedId, direction.targets, settings) : undefined;
  const effective = settings.order === 'staggered' ? 'Décalé' : 'Simultané';
  const order = planned?.steps.map((step) => step.screen).join(' → ') || 'aucun changement';
  const total = planned?.totalMs ?? 0;
  const active = direction.transition;
  return {
    effective, order, total,
    prepared: `${settings.mode === 'virtual-travel' ? 'Trajets successifs' : effective} · ${order}\nDélai ${settings.order === 'staggered' ? settings.delayMs : 0} ms · Total ${total} ms`,
    progress: active?.frame ? active.frame.screens.map((step) => `É${step.screen} ${Math.round(step.progress * 100)} %`).join(' · ') : '',
  };
}
