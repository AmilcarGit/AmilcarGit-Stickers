/** Historial genérico para deshacer / rehacer. Los estados deben tratarse como inmutables. */
export class History<T> {
  private past: T[] = [];
  private future: T[] = [];
  private present: T;

  constructor(initial: T, private readonly limit = 100) {
    this.present = initial;
  }

  get current(): T {
    return this.present;
  }

  get canUndo(): boolean {
    return this.past.length > 0;
  }

  get canRedo(): boolean {
    return this.future.length > 0;
  }

  /** Nuevo estado que se puede deshacer. */
  push(next: T): void {
    this.record(this.present);
    this.present = next;
  }

  /** Cambia el estado actual sin crear un paso (por ejemplo, mientras se arrastra). */
  replace(next: T): void {
    this.present = next;
  }

  /** Cierra un gesto: `before` es el estado previo al gesto, el actual ya fue reemplazado. */
  commitFrom(before: T): void {
    if (before === this.present) return;
    this.record(before);
  }

  undo(): T {
    const prev = this.past.pop();
    if (prev === undefined) return this.present;
    this.future.push(this.present);
    this.present = prev;
    return prev;
  }

  redo(): T {
    const next = this.future.pop();
    if (next === undefined) return this.present;
    this.past.push(this.present);
    this.present = next;
    return next;
  }

  reset(initial: T): void {
    this.past = [];
    this.future = [];
    this.present = initial;
  }

  private record(before: T): void {
    this.past.push(before);
    if (this.past.length > this.limit) this.past.shift();
    this.future = [];
  }
}
