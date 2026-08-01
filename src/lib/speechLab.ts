import type { AudioValidation } from '../types/speechLab'

export const SPEECH_LAB_SAMPLE_RATE = 16_000
const FRAME_MS = 20
const SILENCE_DBFS = -45

function dbfs(value: number): number {
  if (value <= 0) return -120
  return 20 * Math.log10(value)
}

export function normalizeTranscriptTokens(value: string): string[] {
  return value
    .toLocaleLowerCase('de-DE')
    .replace(/[–—-]/g, ' ')
    .replace(/[^\p{L}\p{N}]+/gu, ' ')
    .trim()
    .split(/\s+/)
    .filter(Boolean)
}

export function wordErrorRate(reference: string, hypothesis: string): number {
  const expected = normalizeTranscriptTokens(reference)
  const actual = normalizeTranscriptTokens(hypothesis)
  if (expected.length === 0) return actual.length === 0 ? 0 : 1

  const previous = Array.from({ length: actual.length + 1 }, (_, index) => index)
  for (let expectedIndex = 1; expectedIndex <= expected.length; expectedIndex += 1) {
    const current = [expectedIndex]
    for (let actualIndex = 1; actualIndex <= actual.length; actualIndex += 1) {
      const substitutionCost = expected[expectedIndex - 1] === actual[actualIndex - 1] ? 0 : 1
      current[actualIndex] = Math.min(
        previous[actualIndex] + 1,
        current[actualIndex - 1] + 1,
        previous[actualIndex - 1] + substitutionCost,
      )
    }
    previous.splice(0, previous.length, ...current)
  }

  return previous[actual.length] / expected.length
}

export function isReferenceDuration(audioDurationMs: number): boolean {
  return audioDurationMs >= 3_000 && audioDurationMs <= 12_000
}

export function latencyPass(inferenceMs: number, audioDurationMs: number): boolean {
  if (audioDurationMs <= 0) return false
  const realtimeFactor = inferenceMs / audioDurationMs
  if (!isReferenceDuration(audioDurationMs)) return realtimeFactor <= 0.5
  return inferenceMs <= 1_500 && realtimeFactor <= 0.5
}

export function shouldAbandonBrowserBaseline(
  inferenceMs: number,
  audioDurationMs: number,
  audioEligible: boolean,
): boolean {
  return audioEligible && isReferenceDuration(audioDurationMs) && inferenceMs > 3_000
}

export function analyzePcm(
  pcm: Float32Array,
  metadata: {
    blobSize: number
    mimeType: string
    chunkCount: number
    wallDurationMs: number | null
    decodedDurationMs: number
    decodedSampleRate: number
    captureSampleRate: number | null
    channels: number
  },
): AudioValidation {
  let sumSquares = 0
  let peak = 0
  let nearZeroSamples = 0
  for (const sample of pcm) {
    const absolute = Math.abs(sample)
    sumSquares += sample * sample
    peak = Math.max(peak, absolute)
    if (absolute < 0.0001) nearZeroSamples += 1
  }

  const rms = pcm.length > 0 ? Math.sqrt(sumSquares / pcm.length) : 0
  const frameLength = Math.max(1, Math.round(SPEECH_LAB_SAMPLE_RATE * FRAME_MS / 1_000))
  const silentFrames: boolean[] = []
  for (let start = 0; start < pcm.length; start += frameLength) {
    const end = Math.min(pcm.length, start + frameLength)
    let frameSquares = 0
    for (let index = start; index < end; index += 1) frameSquares += pcm[index] * pcm[index]
    const frameRms = Math.sqrt(frameSquares / Math.max(1, end - start))
    silentFrames.push(dbfs(frameRms) < SILENCE_DBFS)
  }

  let leadingFrames = 0
  while (leadingFrames < silentFrames.length && silentFrames[leadingFrames]) leadingFrames += 1
  let trailingFrames = 0
  while (
    trailingFrames < silentFrames.length
    && silentFrames[silentFrames.length - 1 - trailingFrames]
  ) trailingFrames += 1

  const durationRatio = metadata.wallDurationMs && metadata.wallDurationMs > 0
    ? metadata.decodedDurationMs / metadata.wallDurationMs
    : null
  const nearZeroRatio = pcm.length > 0 ? nearZeroSamples / pcm.length : 1
  const rmsDbfs = dbfs(rms)
  const warnings: string[] = []

  if (metadata.blobSize < 1_000) warnings.push('Der Aufnahme-Blob ist auffällig klein.')
  if (metadata.chunkCount < 1) warnings.push('MediaRecorder hat keine Chunks geliefert.')
  if (metadata.decodedDurationMs < 800) warnings.push('Die dekodierte Aufnahme ist zu kurz.')
  if (durationRatio !== null && (durationRatio < 0.8 || durationRatio > 1.2)) {
    warnings.push('Dekodierte Dauer und reale Aufnahmezeit weichen stark voneinander ab.')
  }
  if (pcm.length === 0) warnings.push('Die Dekodierung hat keine PCM-Samples geliefert.')
  if (nearZeroRatio > 0.9) warnings.push('Mehr als 90 % der PCM-Samples sind praktisch null.')
  if (rmsDbfs < -42) warnings.push('Das dekodierte Signal ist zu leise.')
  if (leadingFrames * FRAME_MS > 1_500) warnings.push('Am Anfang liegen mehr als 1,5 Sekunden Stille.')
  if (trailingFrames * FRAME_MS > 1_500) warnings.push('Am Ende liegen mehr als 1,5 Sekunden Stille.')
  if (metadata.channels < 1) warnings.push('Die Dekodierung enthält keinen Audiokanal.')

  return {
    ...metadata,
    pcmSamples: pcm.length,
    durationRatio,
    rmsDbfs: Math.round(rmsDbfs * 10) / 10,
    peakDbfs: Math.round(dbfs(peak) * 10) / 10,
    nearZeroRatio,
    leadingSilenceMs: leadingFrames * FRAME_MS,
    trailingSilenceMs: trailingFrames * FRAME_MS,
    eligible: warnings.length === 0,
    warnings,
  }
}

function mixToMono(buffer: AudioBuffer): Float32Array {
  const mono = new Float32Array(buffer.length)
  for (let channelIndex = 0; channelIndex < buffer.numberOfChannels; channelIndex += 1) {
    const channel = buffer.getChannelData(channelIndex)
    for (let sampleIndex = 0; sampleIndex < channel.length; sampleIndex += 1) {
      mono[sampleIndex] += channel[sampleIndex] / buffer.numberOfChannels
    }
  }
  return mono
}

async function resampleTo16k(mono: Float32Array, inputSampleRate: number): Promise<Float32Array> {
  if (inputSampleRate === SPEECH_LAB_SAMPLE_RATE) return mono.slice()
  const length = Math.max(1, Math.ceil(mono.length * SPEECH_LAB_SAMPLE_RATE / inputSampleRate))
  const offline = new OfflineAudioContext(1, length, SPEECH_LAB_SAMPLE_RATE)
  const sourceBuffer = offline.createBuffer(1, mono.length, inputSampleRate)
  sourceBuffer.copyToChannel(mono, 0)
  const source = offline.createBufferSource()
  source.buffer = sourceBuffer
  source.connect(offline.destination)
  source.start()
  const rendered = await offline.startRendering()
  return rendered.getChannelData(0).slice()
}

export function encodePcm16Wav(pcm: Float32Array, sampleRate = SPEECH_LAB_SAMPLE_RATE): Blob {
  const bytesPerSample = 2
  const buffer = new ArrayBuffer(44 + pcm.length * bytesPerSample)
  const view = new DataView(buffer)
  const writeText = (offset: number, text: string) => {
    for (let index = 0; index < text.length; index += 1) view.setUint8(offset + index, text.charCodeAt(index))
  }

  writeText(0, 'RIFF')
  view.setUint32(4, 36 + pcm.length * bytesPerSample, true)
  writeText(8, 'WAVE')
  writeText(12, 'fmt ')
  view.setUint32(16, 16, true)
  view.setUint16(20, 1, true)
  view.setUint16(22, 1, true)
  view.setUint32(24, sampleRate, true)
  view.setUint32(28, sampleRate * bytesPerSample, true)
  view.setUint16(32, bytesPerSample, true)
  view.setUint16(34, 16, true)
  writeText(36, 'data')
  view.setUint32(40, pcm.length * bytesPerSample, true)

  let offset = 44
  for (const sample of pcm) {
    const clamped = Math.max(-1, Math.min(1, sample))
    view.setInt16(offset, clamped < 0 ? clamped * 0x8000 : clamped * 0x7fff, true)
    offset += bytesPerSample
  }

  return new Blob([buffer], { type: 'audio/wav' })
}

export async function decodeValidateAndPrepare(
  blob: Blob,
  metadata: {
    chunkCount: number
    wallDurationMs: number | null
    captureSampleRate: number | null
  },
): Promise<{ pcm: Float32Array; validation: AudioValidation; wav: Blob }> {
  if (blob.size === 0) throw new Error('Der Aufnahme-Blob ist leer.')
  const context = new AudioContext()
  try {
    const decoded = await context.decodeAudioData(await blob.arrayBuffer())
    const mono = mixToMono(decoded)
    const pcm = await resampleTo16k(mono, decoded.sampleRate)
    const decodedDurationMs = decoded.duration * 1_000
    const validation = analyzePcm(pcm, {
      blobSize: blob.size,
      mimeType: blob.type || 'unbekannt',
      chunkCount: metadata.chunkCount,
      wallDurationMs: metadata.wallDurationMs,
      decodedDurationMs: Math.round(decodedDurationMs),
      decodedSampleRate: decoded.sampleRate,
      captureSampleRate: metadata.captureSampleRate,
      channels: decoded.numberOfChannels,
    })
    return { pcm, validation, wav: encodePcm16Wav(pcm) }
  } catch (error) {
    throw new Error(
      error instanceof Error
        ? `Aufnahme konnte nicht dekodiert werden: ${error.message}`
        : 'Aufnahme konnte nicht dekodiert werden.',
    )
  } finally {
    await context.close().catch(() => undefined)
  }
}
