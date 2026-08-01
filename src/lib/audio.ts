const WHISPER_SAMPLE_RATE = 16_000

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
