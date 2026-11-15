export class TransitionCancelledError extends Error {
  constructor() { super('Transition annulée.'); this.name = 'TransitionCancelledError'; }
}

/** Also owns abandoned async results, so a late resource cannot leak or publish. */
export function abortable<T>(operation: Promise<T>, signal: AbortSignal, abandoned?: (value: T) => void): Promise<T> {
  return new Promise<T>((resolve, reject) => {
    const abort = () => { signal.removeEventListener('abort', abort); reject(new TransitionCancelledError()); };
    if (signal.aborted) abort(); else signal.addEventListener('abort', abort, { once: true });
    operation.then((value) => {
      signal.removeEventListener('abort', abort);
      if (signal.aborted) abandoned?.(value); else resolve(value);
    }, (error: unknown) => { signal.removeEventListener('abort', abort); reject(error); }).catch(reject);
  });
}
