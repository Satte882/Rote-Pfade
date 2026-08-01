import type { AudioQuality } from '../types/speech'

const WHISPER_SAMPLE_RATE = 16_000
const FRAME_MS = 20

function dbfs(value: number): number {
  if (value <= 0) return -120
  return 20 * Math.log10(value)
}

export function mixChannelsToMono(channels: readonly Float32Array[]): Float32Array {
  if (channels.length === 0) return new Float32Array()
  if (channels.length === 1) return channels[0].slice()

  const length = Math.min(...channels.map((channel) => channel.length))
  const mono = new Float32Array(length)

  for (let sampleIndex = 0; sampleIndex < length; sampleIndex += 1) {
    let sum = 0
    for (const channel of channels) sum += channel[sampleIndex]
    mono[sampleIndex] = sum / channels.length
  }

  return mono
}

export function resampleMono(
  input: Float32Array,
  inputSampleRate: number,
  outputSampleRate = WHISPER_SAMPLE_RATE,
): Float32Array {
  if (!Number.isFinite(inputSampleRate) || inputSampleRate <= 0) {
    throw new Error('Ungültige Abtastrate der Audioaufnahme.')
  }
  if (input.length === 0) return new Float32Array()
  if (inputSampleRate === outputSampleRate) return input.slice()

  const ratio = inputSampleRate / outputSampleRate
  const outputLength = Math.max(1, Math.round(input.length / ratio))
  const output = new Float32Array(outputLength)

  if (ratio < 1) {
    for (let index = 0; index < outputLength; index += 1) {
      const sourcePosition = index * ratio
      const left = Math.floor(sourcePosition)
      const right = Math.min(left + 1, input.length - 1)
      const fraction = sourcePosition - left
      output[index] = input[left] * (1 - fraction) + input[right] * fraction
    }
    return output
  }

  for (let index = 0; index < outputLength; index += 1) {
    const start = index * ratio
    const end = Math.min((index + 1) * ratio, input.length)
    const firstSample = Math.floor(start)
    const lastSample = Math.min(Math.ceil(end), input.length)
    let weightedSum = 0
    let totalWeight = 0

    for (let sourceIndex = firstSample; sourceIndex < lastSample; sourceIndex += 1) {
      const overlapStart = Math.max(start, sourceIndex)
      const overlapEnd = Math.min(end, sourceIndex + 1)
      const weight = Math.max(0, overlapEnd - overlapStart)
      weightedSum += input[sourceIndex] * weight
      totalWeight += weight
    }

    output[index] = totalWeight > 0 ? weightedSum / totalWeight : 0
  }

  return output
}

export function assessAudioQuality(
  audio: Float32Array,
  sampleRate = WHISPER_SAMPLE_RATE,
): AudioQuality {
  const durationMs = audio.length / sampleRate * 1_000
  if (audio.length === 0) {
    return {
      level: 'poor',
      durationMs,
      rmsDbfs: -120,
      peakDbfs: -120,
      clippingRatio: 0,
      silenceRatio: 1,
      benchmarkEligible: false,
      warnings: ['Die Aufnahme enthält keine Audiodaten.'],
    }
  }

  let sumSquares = 0
  let peak = 0
  let clippedSamples = 0
  for (const sample of audio) {
    const absolute = Math.abs(sample)
    sumSquares += sample * sample
    peak = Math.max(peak, absolute)
    if (absolute >= 0.98) clippedSamples += 1
  }

  const rms = Math.sqrt(sumSquares / audio.length)
  const clippingRatio = clippedSamples / audio.length
  const frameLength = Math.max(1, Math.round(sampleRate * FRAME_MS / 1_000))
  let silentFrames = 0
  let frames = 0

  for (let start = 0; start < audio.length; start += frameLength) {
    const end = Math.min(audio.length, start + frameLength)
    let frameSquares = 0
    for (let index = start; index < end; index += 1) frameSquares += audio[index] * audio[index]
    const frameRms = Math.sqrt(frameSquares / Math.max(1, end - start))
    if (dbfs(frameRms) < -42) silentFrames += 1
    frames += 1
  }

  const rmsDbfs = dbfs(rms)
  const peakDbfs = dbfs(peak)
  const silenceRatio = frames > 0 ? silentFrames / frames : 1
  const warnings: string[] = []
  let level: AudioQuality['level'] = 'good'

  if (durationMs < 800) {
    warnings.push('Die Aufnahme ist sehr kurz.')
    level = 'poor'
  }
  if (rmsDbfs < -42) {
    warnings.push('Die Aufnahme ist zu leise.')
    level = 'poor'
  } else if (rmsDbfs < -32 && level !== 'poor') {
    warnings.push('Die Aufnahme ist eher leise.')
    level = 'warning'
  }
  if (clippingRatio > 0.01) {
    warnings.push('Die Aufnahme ist deutlich übersteuert.')
    level = 'poor'
  } else if (clippingRatio > 0.001 && level === 'good') {
    warnings.push('Die Aufnahme enthält übersteuerte Spitzen.')
    level = 'warning'
  }
  if (silenceRatio > 0.75) {
    warnings.push('Die Aufnahme besteht überwiegend aus Stille.')
    level = 'poor'
  } else if (silenceRatio > 0.55 && level === 'good') {
    warnings.push('Die Aufnahme enthält viel Stille.')
    level = 'warning'
  }

  return {
    level,
    durationMs: Math.round(durationMs),
    rmsDbfs: Math.round(rmsDbfs * 10) / 10,
    peakDbfs: Math.round(peakDbfs * 10) / 10,
    clippingRatio,
    silenceRatio,
    benchmarkEligible: level !== 'poor',
    warnings,
  }
}

export async function audioBlobToMono16k(blob: Blob): Promise<Float32Array> {
  if (blob.size === 0) throw new Error('Die Audioaufnahme ist leer.')

  const AudioContextClass = globalThis.AudioContext
  if (!AudioContextClass) throw new Error('Der Browser kann Audio nicht dekodieren.')

  const context = new AudioContextClass()
  try {
    const buffer = await context.decodeAudioData(await blob.arrayBuffer())
    const channels = Array.from(
      { length: buffer.numberOfChannels },
      (_, index) => buffer.getChannelData(index),
    )
    const mono = mixChannelsToMono(channels)
    return resampleMono(mono, buffer.sampleRate, WHISPER_SAMPLE_RATE)
  } catch (error) {
    throw new Error(
      error instanceof Error
        ? `Audio konnte nicht vorbereitet werden: ${error.message}`
        : 'Audio konnte nicht vorbereitet werden.',
    )
  } finally {
    await context.close().catch(() => undefined)
  }
}

export { WHISPER_SAMPLE_RATE }
