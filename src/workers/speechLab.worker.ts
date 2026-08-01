import { env, pipeline } from '@huggingface/transformers'
import type {
  SpeechLabProfileId,
  SpeechLabWorkerMessage,
  SpeechLabWorkerRequest,
} from '../types/speechLab'

const BASE_MODEL = 'onnx-community/whisper-base'
const TINY_MODEL = 'onnx-community/whisper-tiny'

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

type ProfileConfig = {
  model: string
  backend: 'webgpu' | 'wasm'
  dtype: 'q4' | 'q8' | {
    encoder_model: 'fp16'
    decoder_model_merged: 'q8'
  }
}

env.useBrowserCache = true
env.useWasmCache = true
env.allowLocalModels = false
const wasmBackend = env.backends.onnx.wasm
if (wasmBackend) {
  wasmBackend.numThreads = 1
  wasmBackend.proxy = false
}

function send(message: SpeechLabWorkerMessage): void {
  self.postMessage(message)
}

function profileConfig(profile: SpeechLabProfileId): ProfileConfig {
  if (profile === 'base-q4-webgpu') {
    return { model: BASE_MODEL, backend: 'webgpu', dtype: 'q4' }
  }
  if (profile === 'base-q8-webgpu') {
    return { model: BASE_MODEL, backend: 'webgpu', dtype: 'q8' }
  }
  if (profile === 'base-fp16-q8-webgpu') {
    return {
      model: BASE_MODEL,
      backend: 'webgpu',
      dtype: { encoder_model: 'fp16', decoder_model_merged: 'q8' },
    }
  }
  if (profile === 'tiny-q8-webgpu') {
    return { model: TINY_MODEL, backend: 'webgpu', dtype: 'q8' }
  }
  return { model: TINY_MODEL, backend: 'wasm', dtype: 'q8' }
}

function extractText(output: TranscriptionOutput): string {
  if (Array.isArray(output)) return output.map((item) => item.text ?? '').join(' ').trim()
  return output.text?.trim() ?? ''
}

async function infer(transcriber: Transcriber, audio: Float32Array): Promise<{
  text: string
  durationMs: number
}> {
  const startedAt = performance.now()
  const output = await transcriber(audio, {
    language: 'german',
    task: 'transcribe',
    return_timestamps: false,
  })
  return {
    text: extractText(output),
    durationMs: Math.round(performance.now() - startedAt),
  }
}

async function run(request: Extract<SpeechLabWorkerRequest, { type: 'run' }>): Promise<void> {
  const config = profileConfig(request.profile)
  if (config.backend === 'webgpu' && !(typeof navigator !== 'undefined' && 'gpu' in navigator)) {
    throw new Error('WebGPU ist in diesem Browser nicht verfügbar.')
  }

  send({
    type: 'progress',
    id: request.id,
    profile: request.profile,
    progress: null,
    message: 'Modell wird geladen und initialisiert.',
  })

  const loadStartedAt = performance.now()
  const instance = await pipeline('automatic-speech-recognition', config.model, {
    device: config.backend,
    dtype: config.dtype,
    progress_callback: (value: unknown) => {
      const progress = typeof value === 'object' && value !== null
        ? value as Record<string, unknown>
        : {}
      const direct = typeof progress.progress === 'number' ? progress.progress : null
      const ratio = typeof progress.loaded === 'number' && typeof progress.total === 'number' && progress.total > 0
        ? progress.loaded / progress.total * 100
        : null
      send({
        type: 'progress',
        id: request.id,
        profile: request.profile,
        progress: direct ?? ratio,
        message: 'Modell wird geladen und initialisiert.',
      })
    },
  })
  const transcriber = instance as unknown as Transcriber
  const modelLoadMs = Math.round(performance.now() - loadStartedAt)

  try {
    send({
      type: 'progress',
      id: request.id,
      profile: request.profile,
      progress: null,
      message: 'Erster Lauf inklusive Backend-Aufwärmung.',
    })
    const first = await infer(transcriber, request.audio)

    send({
      type: 'progress',
      id: request.id,
      profile: request.profile,
      progress: null,
      message: 'Zweiter Lauf mit bereits warmem Modell.',
    })
    const warm = await infer(transcriber, request.audio)

    if (!first.text && !warm.text) throw new Error('Whisper hat in beiden Läufen keinen Text erkannt.')

    send({
      type: 'result',
      id: request.id,
      profile: request.profile,
      model: config.model,
      backend: config.backend,
      modelLoadMs,
      firstInferenceMs: first.durationMs,
      warmInferenceMs: warm.durationMs,
      firstTranscript: first.text,
      warmTranscript: warm.text,
      audioDurationMs: request.audioDurationMs,
    })
  } finally {
    await transcriber.dispose?.()
  }
}

self.addEventListener('message', (event: MessageEvent<SpeechLabWorkerRequest>) => {
  const request = event.data
  void run(request).catch((error) => {
    send({
      type: 'error',
      id: request.id,
      profile: request.profile,
      message: error instanceof Error ? error.message : 'Der Modelltest ist fehlgeschlagen.',
    })
  })
})
