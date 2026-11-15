import { expect, it, vi } from 'vitest';
import { TransitionOperation } from '../../src/application/commands/transitionOperation';
import { planTransition } from '../../src/domain/direction/transitionPlan';
import { deferred } from '../helpers/routingFixture';

it.each(['complete', 'cancel', 'error'])('awaits asynchronous render before sampling or committing, including %s', async (outcome) => {
  const first = deferred(), last = deferred();
  const session = { render: vi.fn().mockReturnValueOnce(first.ready).mockReturnValueOnce(last.ready), commit: vi.fn(async () => {}), complete: vi.fn(), rollback: vi.fn() };
  const driver = { supportedModes: ['dissolve' as const], prepare: vi.fn(async () => session), sample: () => ({ nowMs: 0, visible: true }), nextSample: vi.fn(async () => ({ nowMs: 600, visible: true })) };
  const operation = new TransitionOperation({ prepare: vi.fn(), dispose: vi.fn() }, driver);
  const run = operation.execute(planTransition({ 1: 1, 2: 1, 3: 1 }, 4, [1], { mode: 'dissolve' }));
  const result = outcome === 'complete' ? run : expect(run).rejects.toThrow();
  await vi.waitFor(() => expect(session.render).toHaveBeenCalledOnce()); expect(driver.nextSample).not.toHaveBeenCalled();
  first.resolve(); await vi.waitFor(() => expect(session.render).toHaveBeenCalledTimes(2)); expect(session.commit).not.toHaveBeenCalled();
  if (outcome === 'cancel') operation.cancel(); else if (outcome === 'error') last.reject(new Error('Rendu asynchrone impossible.')); else last.resolve();
  await result;
  if (outcome === 'complete') { expect(session.complete).toHaveBeenCalledOnce(); expect(session.rollback).not.toHaveBeenCalled(); }
  else { expect(session.rollback).toHaveBeenCalledOnce(); expect(session.commit).not.toHaveBeenCalled(); last.resolve(); }
  operation.dispose();
});
