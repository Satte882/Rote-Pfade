export type WarmPerformanceSample = {
  inferenceMs: number
  realtimeFactor: number
}

export function median(values: readonly number[]): number {
  if (values.length === 0) return 0
  const sorted = [...values].sort((left, right) => left - right)
  const middle = Math.floor(sorted.length / 2)
  if (sorted.length % 2 === 1) return sorted[middle]
  return (sorted[middle - 1] + sorted[middle]) / 2
}

export function shouldRecommendBalancedProfile(
  samples: readonly WarmPerformanceSample[],
): boolean {
  if (samples.length < 2) return false
  const recent = samples.slice(-5)
  return median(recent.map((sample) => sample.inferenceMs)) >= 3_500
    && median(recent.map((sample) => sample.realtimeFactor)) >= 1.25
}
