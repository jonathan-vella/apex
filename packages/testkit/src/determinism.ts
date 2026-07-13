export class FakeClock {
  #currentMs: number;

  constructor(initial: string | Date | number = "2026-01-01T00:00:00.000Z") {
    this.#currentMs = new Date(initial).getTime();
    if (!Number.isFinite(this.#currentMs)) {
      throw new Error("FakeClock requires a valid initial time");
    }
  }

  readonly now = (): Date => new Date(this.#currentMs);

  advance(milliseconds: number): Date {
    if (!Number.isFinite(milliseconds)) {
      throw new Error("FakeClock advance must be finite");
    }
    this.#currentMs += milliseconds;
    return this.now();
  }

  set(value: string | Date | number): Date {
    const nextMs = new Date(value).getTime();
    if (!Number.isFinite(nextMs)) {
      throw new Error("FakeClock requires a valid time");
    }
    this.#currentMs = nextMs;
    return this.now();
  }
}

export class SequenceIds {
  #next: number;

  constructor(
    private readonly prefix = "id",
    start = 1,
  ) {
    if (!Number.isSafeInteger(start) || start < 0) {
      throw new Error("SequenceIds start must be a non-negative safe integer");
    }
    this.#next = start;
  }

  readonly next = (): string => `${this.prefix}-${String(this.#next++).padStart(4, "0")}`;
}
