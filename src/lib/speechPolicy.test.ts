import { describe, expect, it } from 'vitest'
import { median, shouldRecommendBalancedProfile } from './speechPolicy'

describe('median', () => {
  it('handles odd and even lists', () => {
    expect(median([3, 1, 2])).toBe(2)
    expect(median([4, 1, 3, 2])).toBe(2.5)
  })
})

describe('shouldRecommendBalancedProfile', () => {
  it('requires at least two warm samples', () => {
    expect(shouldRecommendBalancedProfile([{ inferenceMs: 5_000, realtimeFactor: 2 }])).toBe(false)
  })

  it('recommends q8/q8 only for repeatedly slow warm inference', () => {
    expect(shouldRecommendBalancedProfile([
      { inferenceMs: 4_200, realtimeFactor: 1.5 },
      { inferenceMs: 4_600, realtimeFactor: 1.7 },
    ])).toBe(true)
  })

  it('does not recommend a downgrade for isolated or moderate latency', () => {
    expect(shouldRecommendBalancedProfile([
      { inferenceMs: 5_000, realtimeFactor: 1.6 },
      { inferenceMs: 1_500, realtimeFactor: 0.5 },
    ])).toBe(false)
  })
})
