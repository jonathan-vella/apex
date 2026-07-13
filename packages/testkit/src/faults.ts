import { fixtureHash } from "./fixtures.js";

export class InjectedFault extends Error {
  constructor(point: string) {
    super(`Injected fault: ${point}`);
    this.name = "InjectedFault";
  }
}

export async function crashBefore<T>(callback: () => T | Promise<T>, point = "before-callback"): Promise<never> {
  void callback;
  throw new InjectedFault(point);
}

export async function crashAfter<T>(callback: () => T | Promise<T>, point = "after-callback"): Promise<never> {
  await callback();
  throw new InjectedFault(point);
}

export function staleEpoch(currentEpoch: number): number {
  if (!Number.isInteger(currentEpoch) || currentEpoch <= 1) {
    throw new Error("A stale epoch requires a current epoch greater than one");
  }
  return currentEpoch - 1;
}

export function staleHead(currentHead: string): string {
  const stale = fixtureHash(`stale:${currentHead}`);
  return stale === currentHead ? fixtureHash(`stale-again:${currentHead}`) : stale;
}
