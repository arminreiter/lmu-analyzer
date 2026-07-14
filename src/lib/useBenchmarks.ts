import { useState, useEffect, useMemo } from 'react';
import { fetchBenchmarks, buildBenchmarkMap, type PaceBenchmark } from './racepace';

/** Shared benchmark-loading state machine for the pace views. */
export function useBenchmarks() {
  const [benchmarks, setBenchmarks] = useState<PaceBenchmark[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    fetchBenchmarks()
      .then(data => { if (!cancelled) setBenchmarks(data); })
      .catch((e: unknown) => { if (!cancelled) setError(e instanceof Error ? e.message : String(e)); });
    return () => { cancelled = true; };
  }, []);

  const benchmarkMap = useMemo(() => (benchmarks ? buildBenchmarkMap(benchmarks) : null), [benchmarks]);

  return { benchmarks, benchmarkMap, loading: benchmarks === null && error === null, error };
}
