import { describe, expect, it } from 'vitest'
import { mixChannelsToMono, resampleMono, WHISPER_SAMPLE_RATE } from './audio'

describe('mixChannelsToMono', () => {
  it('returns a copy for mono input', () => {
    const input = new Float32Array([0.25, -0.5, 1])
    const result = mixChannelsToMono([input])
    expect(Array.from(result)).toEqual([0.25, -0.5, 1])
    expect(result).not.toBe(input)
  })

  it('averages stereo channels sample by sample', () => {
    const left = new Float32Array([1, 0, -1])
    const right = new Float32Array([-1, 0.5, 1])
    expect(Array.from(mixChannelsToMono([left, right]))).toEqual([0, 0.25, 0])
  })
})

describe('resampleMono', () => {
  it('converts one second at 48 kHz to one second at 16 kHz', () => {
    const input = new Float32Array(48_000).fill(0.5)
    const result = resampleMono(input, 48_000)
    expect(result).toHaveLength(WHISPER_SAMPLE_RATE)
    expect(result[0]).toBeCloseTo(0.5)
    expect(result[result.length - 1]).toBeCloseTo(0.5)
  })

  it('preserves the number of samples at 16 kHz', () => {
    const input = new Float32Array([0, 0.25, -0.25, 1])
    const result = resampleMono(input, WHISPER_SAMPLE_RATE)
    expect(Array.from(result)).toEqual(Array.from(input))
    expect(result).not.toBe(input)
  })

  it('upsamples lower-rate input without invalid values', () => {
    const result = resampleMono(new Float32Array([0, 1, 0]), 8_000)
    expect(result).toHaveLength(6)
    expect(Array.from(result).every(Number.isFinite)).toBe(true)
  })

  it('rejects invalid sample rates', () => {
    expect(() => resampleMono(new Float32Array([1]), 0)).toThrow('Abtastrate')
  })
})
