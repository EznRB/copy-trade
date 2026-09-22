/**
 * @ct/metrics — Registry simples in-memory (counters, gauges, histogramas).
 * Nota: exportação para Prometheus será adicionada em fase futura (devops).
 */

type Labels = Record<string, string>;

function labelsKey(labels: Labels | undefined): string {
  if (!labels) return '';
  const keys = Object.keys(labels).sort();
  return keys.map((k) => `${k}=${labels[k] ?? ''}`).join(',');
}

export interface Counter {
  inc(amount?: number): void;
  get(): number;
}

export interface Gauge {
  inc(amount?: number): void;
  dec(amount?: number): void;
  set(value: number): void;
  get(): number;
}

export interface Histogram {
  observe(value: number): void;
  count(): number;
  sum(): number;
  buckets(): ReadonlyMap<number, number>;
}

class CounterImpl implements Counter {
  protected value = 0;
  inc(amount = 1): void {
    if (amount < 0) throw new Error('Counter.inc requer amount >= 0');
    this.value += amount;
  }
  get(): number {
    return this.value;
  }
}

class GaugeImpl implements Gauge {
  private value = 0;
  inc(amount = 1): void {
    this.value += amount;
  }
  dec(amount = 1): void {
    this.value -= amount;
  }
  set(value: number): void {
    this.value = value;
  }
  get(): number {
    return this.value;
  }
}

const DEFAULT_BUCKETS = [0.005, 0.01, 0.025, 0.05, 0.1, 0.25, 0.5, 1, 2.5, 5, 10, 60];

class HistogramImpl implements Histogram {
  private readonly bucketBounds: number[];
  private readonly bucketCounts: Map<number, number> = new Map();
  private totalCount = 0;
  private totalSum = 0;

  constructor(buckets: number[] = DEFAULT_BUCKETS) {
    this.bucketBounds = [...buckets].sort((a, b) => a - b);
    for (const b of this.bucketBounds) this.bucketCounts.set(b, 0);
  }

  observe(value: number): void {
    this.totalCount += 1;
    this.totalSum += value;
    for (const b of this.bucketBounds) {
      if (value <= b) {
        this.bucketCounts.set(b, (this.bucketCounts.get(b) ?? 0) + 1);
      }
    }
  }

  count(): number {
    return this.totalCount;
  }
  sum(): number {
    return this.totalSum;
  }
  buckets(): ReadonlyMap<number, number> {
    return this.bucketCounts;
  }
}

export interface MetricsSnapshot {
  counters: Record<string, number>;
  gauges: Record<string, number>;
  histograms: Record<string, { count: number; sum: number; buckets: Record<string, number> }>;
}

export class MetricsRegistry {
  private readonly counters = new Map<string, Map<string, CounterImpl>>();
  private readonly gauges = new Map<string, Map<string, GaugeImpl>>();
  private readonly histograms = new Map<string, Map<string, HistogramImpl>>();

  counter(name: string, labels?: Labels): Counter {
    return this.getOrCreate(this.counters, name, labels, () => new CounterImpl());
  }

  gauge(name: string, labels?: Labels): Gauge {
    return this.getOrCreate(this.gauges, name, labels, () => new GaugeImpl());
  }

  histogram(name: string, labels?: Labels, buckets?: number[]): Histogram {
    return this.getOrCreate(this.histograms, name, labels, () => new HistogramImpl(buckets));
  }

  private getOrCreate<T>(
    store: Map<string, Map<string, T>>,
    name: string,
    labels: Labels | undefined,
    create: () => T,
  ): T {
    let byLabel = store.get(name);
    if (!byLabel) {
      byLabel = new Map();
      store.set(name, byLabel);
    }
    const key = labelsKey(labels);
    let instance = byLabel.get(key);
    if (!instance) {
      instance = create();
      byLabel.set(key, instance);
    }
    return instance;
  }

  snapshot(): MetricsSnapshot {
    const snap: MetricsSnapshot = { counters: {}, gauges: {}, histograms: {} };
    for (const [name, byLabel] of this.counters) {
      for (const [lbl, c] of byLabel) {
        snap.counters[lbl ? `${name}{${lbl}}` : name] = c.get();
      }
    }
    for (const [name, byLabel] of this.gauges) {
      for (const [lbl, g] of byLabel) {
        snap.gauges[lbl ? `${name}{${lbl}}` : name] = g.get();
      }
    }
    for (const [name, byLabel] of this.histograms) {
      for (const [lbl, h] of byLabel) {
        const buckets: Record<string, number> = {};
        for (const [b, c] of h.buckets()) buckets[`le=${b}`] = c;
        snap.histograms[lbl ? `${name}{${lbl}}` : name] = {
          count: h.count(),
          sum: h.sum(),
          buckets,
        };
      }
    }
    return snap;
  }
}
