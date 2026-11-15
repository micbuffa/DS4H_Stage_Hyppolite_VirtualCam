import { expect, it, vi } from 'vitest';
import { NullEngine } from '@babylonjs/core/Engines/nullEngine';
import { Scene } from '@babylonjs/core/scene';
import { createTransitionDriver } from '../../../src/infrastructure/babylon/rendering/createTransitionDriver';
import { TransitionClock } from '../../../src/domain/direction/transitionClock';
import { routingFixture } from '../../helpers/routingFixture';

it.each([false, true])('remembers hidden time between samples even when a draw is pending (initially hidden: %s)', (initialHidden) => {
  const engine = new NullEngine(); const scene = new Scene(engine); const f = routingFixture();
  const events = new EventTarget(); let hidden = initialHidden, now = 0;
  const document = Object.defineProperties(events, { hidden: { get: () => hidden }, defaultView: { value: { performance: { now: () => now } } } }) as unknown as Document;
  const added = vi.spyOn(events, 'addEventListener'), removed = vi.spyOn(events, 'removeEventListener');
  const driver = createTransitionDriver(scene, document, f.router, { prepare: vi.fn() });
  const clock = new TransitionClock();
  const read = () => { const sample = driver.sample(); return clock.sample(sample.nowMs, sample.visible); };
  try {
    expect(read()).toBe(0);
    // No nextSample subscription exists during this interval: a pending render owns it.
    if (initialHidden) {
      now = 5000; expect(read()).toBe(0);
      hidden = false; events.dispatchEvent(new Event('visibilitychange')); expect(read()).toBe(0); now += 100;
    }
    now += 100; hidden = true; events.dispatchEvent(new Event('visibilitychange'));
    now += 5000; hidden = false; events.dispatchEvent(new Event('visibilitychange'));
    expect(read()).toBe(initialHidden ? 200 : 100);
    now += 100; expect(read()).toBe(initialHidden ? 300 : 200);
    expect(added.mock.calls.filter(([type]) => type === 'visibilitychange')).toHaveLength(1);
    scene.dispose(); expect(removed.mock.calls.filter(([type]) => type === 'visibilitychange')).toHaveLength(1);
    expect(() => driver.sample()).toThrow('annulée');
  } finally { f.director.dispose(); scene.dispose(); engine.dispose(); }
});
