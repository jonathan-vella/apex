import { performance } from "node:perf_hooks";

export interface BenchmarkMetric {
  samples: number;
  p50Ms: number;
  p95Ms: number;
}
export interface KernelBenchmarkReport {
  schemaVersion: "1.0.0";
  iterations: number;
  append: BenchmarkMetric;
  replay: BenchmarkMetric;
  status: BenchmarkMetric;
}

export function benchmarkKernel(iterations = 100): KernelBenchmarkReport {
  if (!Number.isInteger(iterations) || iterations < 1) throw new Error("Benchmark iterations must be positive");
  const events: { sequence: number; type: string }[] = [];
  const append: number[] = [];
  const replay: number[] = [];
  const status: number[] = [];
  for (let index = 0; index < iterations; index += 1) {
    let started = performance.now();
    events.push({ sequence: index + 1, type: index === iterations - 1 ? "completed" : "progress" });
    append.push(performance.now() - started);
    started = performance.now();
    events.map((event) => ({ ...event }));
    replay.push(performance.now() - started);
    started = performance.now();
    events.reduce((current, event) => (event.type === "completed" ? "completed" : current), "running");
    status.push(performance.now() - started);
  }
  return { schemaVersion: "1.0.0", iterations, append: metric(append), replay: metric(replay), status: metric(status) };
}

function metric(values: number[]): BenchmarkMetric {
  const sorted = [...values].sort((left, right) => left - right);
  return { samples: values.length, p50Ms: percentile(sorted, 0.5), p95Ms: percentile(sorted, 0.95) };
}

function percentile(values: number[], percentileValue: number): number {
  return Number((values[Math.max(0, Math.ceil(values.length * percentileValue) - 1)] ?? 0).toFixed(6));
}
