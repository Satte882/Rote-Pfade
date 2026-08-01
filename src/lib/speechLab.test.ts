import { describe, expect, it } from 'vitest'
import {
  analyzePcm,
  latencyPass,
  normalizeTranscriptTokens,
  shouldAbandonBrowserBaseline,
  SPEECH_LAB_SAMPLE_RATE,
  wordErrorRate,
} from './speechLab'

function clearReferenceAudio(seconds = 4): Float32Array {
  const audio = new Float32Array(SPEECH_LAB_SAMPLE_RATE * seconds)
  for (let index = 0; index < audio.length; index += 1) {
    audio[index] = Math.sin(index / 12) * 0.12
  }
  return audio
}

describe('wordErrorRate', () => {
  it('normalizes punctuation and hyphenated business terms', () => {
    expect(normalizeTranscriptTokens('Make-or-Buy, bitte!')).toEqual(['make', 'or', 'buy', 'bitte'])
    expect(wordErrorRate(
      'Wie würdest du eine Make-or-Buy-Entscheidung treffen?',
      'Wie würdest du eine Make or Buy Entscheidung treffen',
    )).toBe(0)
  })

  it('calculates a token-level error rate', () => {
    expect(wordErrorRate('eins zwei drei vier', 'eins zwei falsch vier')).toBe(0.25)
  })
})

describe('latency criteria', () => {
  it('requires both the absolute and relative threshold for 3–12 second references', () => {
    expect(latencyPass(1_400, 4_000)).toBe(true)
    expect(latencyPass(1_600, 4_000)).toBe(false)
    expect(latencyPass(1_400, 2_000)).toBe(false)
  })

  it('stops browser experiments when the warm q4 baseline exceeds three seconds', () => {
    expect(shouldAbandonBrowserBaseline(3_001, 5_000, true)).toBe(true)
    expect(shouldAbandonBrowserBaseline(2_999, 5_000, true)).toBe(false)
    expect(shouldAbandonBrowserBaseline(4_000, 5_000, false)).toBe(false)
    expect(shouldAbandonBrowserBaseline(4_000, 15_000, true)).toBe(false)
  })
})

describe('audio validation', () => {
  it('accepts coherent decoded PCM with matching wall duration', () => {
    const validation = analyzePcm(clearReferenceAudio(), {
      blobSize: 24_000,
      mimeType: 'audio/webm;codecs=opus',
      chunkCount: 16,
      wallDurationMs: 4_000,
      decodedDurationMs: 4_000,
      decodedSampleRate: 48_000,
      captureSampleRate: 48_000,
      channels: 1,
    })
    expect(validation.eligible).toBe(true)
    expect(validation.warnings).toEqual([])
    expect(validation.pcmSamples).toBe(64_000)
  })

  it('rejects empty-like PCM and a corrupt duration relationship', () => {
    const validation = analyzePcm(new Float32Array(SPEECH_LAB_SAMPLE_RATE * 4), {
      blobSize: 120,
      mimeType: 'audio/webm',
      chunkCount: 0,
      wallDurationMs: 4_000,
      decodedDurationMs: 500,
      decodedSampleRate: 48_000,
      captureSampleRate: 48_000,
      channels: 1,
    })
    expect(validation.eligible).toBe(false)
    expect(validation.warnings.join(' ')).toContain('Blob')
    expect(validation.warnings.join(' ')).toContain('Chunks')
    expect(validation.warnings.join(' ')).toContain('Dauer')
    expect(validation.warnings.join(' ')).toContain('PCM')
  })
})
