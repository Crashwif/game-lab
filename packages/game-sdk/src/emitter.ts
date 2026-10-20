/** A small typed event emitter (no dependency, works in browsers and Node). */
export class Emitter<Events extends Record<string, (...args: never[]) => void>> {
  private readonly handlers = new Map<keyof Events, Set<(...args: unknown[]) => void>>();

  on<K extends keyof Events>(event: K, handler: Events[K]): () => void {
    let set = this.handlers.get(event);
    if (!set) {
      set = new Set();
      this.handlers.set(event, set);
    }
    set.add(handler as unknown as (...args: unknown[]) => void);
    return () => this.off(event, handler);
  }

  off<K extends keyof Events>(event: K, handler: Events[K]): void {
    this.handlers.get(event)?.delete(handler as unknown as (...args: unknown[]) => void);
  }

  protected emit<K extends keyof Events>(event: K, ...args: Parameters<Events[K]>): void {
    for (const handler of [...(this.handlers.get(event) ?? [])]) handler(...(args as unknown[]));
  }

  protected clearHandlers(): void {
    this.handlers.clear();
  }
}
