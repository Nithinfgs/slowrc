export function median(xs) {
  if (xs.length === 0) return NaN;
  const s = [...xs].sort((a, b) => a - b);
  const mid = s.length >> 1;
  return s.length % 2 ? s[mid] : (s[mid - 1] + s[mid]) / 2;
}

/** Median absolute deviation: a spread estimate that ignores one-off outliers. */
export function mad(xs) {
  const m = median(xs);
  return median(xs.map((x) => Math.abs(x - m)));
}

export function summarize(xs) {
  return {
    runs: xs.length,
    median: median(xs),
    min: Math.min(...xs),
    max: Math.max(...xs),
    mad: mad(xs),
  };
}
