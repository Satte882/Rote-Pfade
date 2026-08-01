import { env, pipeline } from '@huggingface/transformers'
import type {
  SpeechBackend,
  SpeechProfile,
  SpeechProgressMessage,
  SpeechWorkerMessage,
  SpeechWorkerRequest,
} from '../types/speech'

const BASE_MODEL = 'onnx-community/whisper-base'
const CPU_FALLBACK_MODEL = 'onnx-community/whisper-tiny'

type TranscriptionOutput = { text?: string } | Array<{ text?: string }>
type Transcriber = ((
  audio: Float32Array,
  options: {
    language: string
    task: 'transcribe'
    return_timestamps: false
  },
) => Promise<TranscriptionOutput>) & {
  dispose?: () => void | Promise<void>
}

type LoadedPipeline = {
  transcriber: Transcriber
  backend: SpeechBackend
  profile: SpeechProfile
  model: string
  modelLoadMs: number
}

type WebGpuProfile = Exclude<SpeechProfile, 'cpu-tiny-q8'>

let loadedPipeline: Promise<LoadedPipeline> | null = null
let loadedProfile: SpeechProfile | null = null

env.useBrowserCache = true
env.useWasmCache = true
env.allowLocalModels = false
const wasmBackend = env.backends.onnx.wasm
if (wasmBackend) {
  wasmBackend.numThreads = 1
  wasmBackend.proxy = false
}

function send(message: SpeechWorkerMessage): void {
  self.postMessage(message)
}

function progressMessage(id: string, value: unknown): SpeechProgressMessage {
  const progress = typeof value === 'object' && value !== null
    ? value as Record<string, unknown>
    : {}

  return {
    type: 'progress',
    id,
    status: typeof progress.status === 'string' ? progress.status : undefined,
    file: typeof progress.file === 'string' ? progress.file : undefined,
    progress: typeof progress.progress === 'number' ? progress.progress : undefined,
    loaded: typeof progress.loaded === 'number' ? progress.loaded : undefined,
    total: typeof progress.total === 'number' ? progress.total : undefined,
  }
}

function profileLabel(profile: SpeechProfile): string {
  if (profile === 'quality-fp16-q8') return 'Whisper Base · Encoder FP16 / Decoder q8'
  if (profile === 'balanced-q8') return 'Whisper Base · q8/q8'
  return 'Whisper Tiny · CPU q8'
}

async function disposeLoadedPipeline(): Promise<void> {
  const current = loadedPipeline
  loadedPipeline = null
  loadedProfile = null
  if (!current) return
  try {
    const resolved = await current
    await resolved.transcriber.dispose?.()
  } catch {
    // A failed pipeline has nothing reliable to dispose.
  }
}

async function createTranscriber(
  id: string,
  profile: SpeechProfile,
): Promise<LoadedPipeline> {
  const startedAt = performance.now()
  const backend: SpeechBackend = profile === 'cpu-tiny-q8' ? 'wasm' : 'webgpu'
  const model = profile === 'cpu-tiny-q8' ? CPU_FALLBACK_MODEL : BASE_MODEL

  send({
    type: 'status',
    id,
    phase: 'loading-model',
    backend,
    profile,
    model,
    message: `${profileLabel(profile)} wird vorbereitet.`,
  })

  const dtype = profile === 'quality-fp16-q8'
    ? { encoder_model: 'fp16', decoder_model_merged: 'q8' } as const
    : profile === 'balanced-q8'
      ? { encoder_model: 'q8', decoder_model_merged: 'q8' } as const
      : 'q8' as const

  const instance = await pipeline('automatic-speech-recognition', model, {
    device: backend,
    dtype,
    progress_callback: (value) => send(progressMessage(id, value)),
  })

  return {
    transcriber: instance as unknown as Transcriber,
    backend,
    profile,
    model,
    modelLoadMs: Math.round(performance.now() - startedAt),
  }
}

function candidateProfiles(preferred: WebGpuProfile): SpeechProfile[] {
  const webGpuAvailable = typeof navigator !== 'undefined' && 'gpu' in navigator
  if (!webGpuAvailable) return ['cpu-tiny-q8']
  return preferred === 'quality-fp16-q8'
    ? ['quality-fp16-q8', 'balanced-q8', 'cpu-tiny-q8']
    : ['balanced-q8', 'cpu-tiny-q8']
}

async function startPipeline(
  id: string,
  preferred: WebGpuProfile,
): Promise<LoadedPipeline> {
  let lastError: unknown
  for (const profile of candidateProfiles(preferred)) {
    try {
      const next = await createTranscriber(id, profile)
      loadedProfile = next.profile
      return next
    } catch (error) {
      lastError = error
      const nextProfile = profile === 'quality-fp16-q8'
        ? 'balanced-q8'
        : profile === 'balanced-q8'
          ? 'cpu-tiny-q8'
          : null
      if (nextProfile) {
        send({
          type: 'status',
          id,
          phase: 'fallback',
          profile: nextProfile,
          backend: nextProfile === 'cpu-tiny-q8' ? 'wasm' : 'webgpu',
          model: nextProfile === 'cpu-tiny-q8' ? CPU_FALLBACK_MODEL : BASE_MODEL,
          message: `${profileLabel(profile)} ist technisch fehlgeschlagen. Fallback auf ${profileLabel(nextProfile)}.`,
        })
      }
    }
  }

  throw lastError instanceof Error ? lastError : new Error('Kein Sprachmodell konnte initialisiert werden.')
}

async function getPipeline(
  id: string,
  preferred: WebGpuProfile,
): Promise<{ pipeline: LoadedPipeline; reused: boolean }> {
  if (loadedPipeline && loadedProfile) {
    const acceptable = loadedProfile === preferred
      || (preferred === 'quality-fp16-q8' && loadedProfile === 'balanced-q8')
      || loadedProfile === 'cpu-tiny-q8'
    if (acceptable) return { pipeline: await loadedPipeline, reused: true }
    await disposeLoadedPipeline()
  }

  loadedProfile = preferred
  loadedPipeline = startPipeline(id, preferred)
  try {
    return { pipeline: await loadedPipeline, reused: false }
  } catch (error) {
    loadedPipeline = null
    loadedProfile = null
    throw error
  }
}

async function replacePipeline(
  id: string,
  preferred: WebGpuProfile,
): Promise<LoadedPipeline> {
  await disposeLoadedPipeline()
  return (await getPipeline(id, preferred)).pipeline
}

function extractText(output: TranscriptionOutput): string {
  if (Array.isArray(output)) return output.map((item) => item.text ?? '').join(' ').trim()
  return output.text?.trim() ?? ''
}

async function prepare(request: Extract<SpeechWorkerRequest, { type: 'prepare' }>): Promise<void> {
  const resolved = await getPipeline(request.id, request.preferredProfile)
  send({
    type: 'ready',
    id: request.id,
    backend: resolved.pipeline.backend,
    profile: resolved.pipeline.profile,
    model: resolved.pipeline.model,
    modelLoadMs: resolved.pipeline.modelLoadMs,
    reused: resolved.reused,
  })
}

async function runInference(
  active: LoadedPipeline,
  audio: Float32Array,
): Promise<{ output: TranscriptionOutput; inferenceMs: number }> {
  const startedAt = performance.now()
  const output = await active.transcriber(audio, {
    language: 'german',
    task: 'transcribe',
    return_timestamps: false,
  })
  return { output, inferenceMs: Math.round(performance.now() - startedAt) }
}

async function transcribe(request: Extract<SpeechWorkerRequest, { type: 'transcribe' }>): Promise<void> {
  const workerStartedAt = performance.now()
  const modelWaitStartedAt = performance.now()
  const resolved = await getPipeline(request.id, request.preferredProfile)
  let active = resolved.pipeline
  const modelWaitMs = Math.round(performance.now() - modelWaitStartedAt)

  send({
    type: 'status',
    id: request.id,
    phase: 'transcribing',
    backend: active.backend,
    profile: active.profile,
    model: active.model,
    message: `Transkription läuft · ${profileLabel(active.profile)}.`,
  })

  let inference: { output: TranscriptionOutput; inferenceMs: number }
  try {
    inference = await runInference(active, request.audio)
  } catch (error) {
    if (active.profile === 'quality-fp16-q8') {
      send({
        type: 'status',
        id: request.id,
        phase: 'fallback',
        backend: 'webgpu',
        profile: 'balanced-q8',
        model: BASE_MODEL,
        message: 'FP16-WebGPU-Inferenz fehlgeschlagen. Erneuter Versuch mit q8/q8.',
      })
      active = await replacePipeline(request.id, 'balanced-q8')
      inference = await runInference(active, request.audio)
    } else if (active.profile === 'balanced-q8') {
      send({
        type: 'status',
        id: request.id,
        phase: 'fallback',
        backend: 'wasm',
        profile: 'cpu-tiny-q8',
        model: CPU_FALLBACK_MODEL,
        message: 'WebGPU-Inferenz fehlgeschlagen. Erneuter Versuch mit Whisper Tiny auf der CPU.',
      })
      await disposeLoadedPipeline()
      loadedProfile = 'cpu-tiny-q8'
      loadedPipeline = createTranscriber(request.id, 'cpu-tiny-q8')
      active = await loadedPipeline
      inference = await runInference(active, request.audio)
    } else {
      throw error
    }
  }

  const text = extractText(inference.output)
  if (!text) throw new Error('Whisper hat keinen Text erkannt.')

  send({
    type: 'result',
    id: request.id,
    text,
    backend: active.backend,
    profile: active.profile,
    model: active.model,
    modelWaitMs,
    modelLoadMs: active.modelLoadMs,
    inferenceMs: inference.inferenceMs,
    totalWorkerMs: Math.round(performance.now() - workerStartedAt),
    audioDurationMs: request.audioDurationMs,
    realtimeFactor: request.audioDurationMs > 0
      ? Math.round(inference.inferenceMs / request.audioDurationMs * 100) / 100
      : 0,
  })
}

self.addEventListener('message', (event: MessageEvent<SpeechWorkerRequest>) => {
  const request = event.data
  const operation = request.type === 'prepare' ? prepare(request) : transcribe(request)
  void operation.catch((error) => {
    send({
      type: 'error',
      id: request.id,
      message: error instanceof Error ? error.message : 'Transkription fehlgeschlagen.',
    })
  })
})
