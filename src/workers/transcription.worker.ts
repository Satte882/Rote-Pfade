import { env, pipeline } from '@huggingface/transformers'
import type {
  SpeechBackend,
  SpeechProgressMessage,
  SpeechWorkerMessage,
  SpeechWorkerRequest,
} from '../types/speech'

const PRIMARY_MODEL = 'onnx-community/whisper-base'
const FALLBACK_MODEL = 'onnx-community/whisper-tiny'

type TranscriptionOutput = { text?: string } | Array<{ text?: string }>
type Transcriber = (
  audio: Float32Array,
  options: {
    language: string
    task: 'transcribe'
    return_timestamps: false
  },
) => Promise<TranscriptionOutput>

type LoadedPipeline = {
  transcriber: Transcriber
  backend: SpeechBackend
  model: string
}

let loadedPipeline: Promise<LoadedPipeline> | null = null

env.useBrowserCache = true
env.allowLocalModels = false
env.backends.onnx.wasm.numThreads = 1
env.backends.onnx.wasm.proxy = false

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

async function createTranscriber(
  id: string,
  backend: SpeechBackend,
  model: string,
): Promise<LoadedPipeline> {
  send({
    type: 'status',
    id,
    phase: 'loading-model',
    backend,
    model,
    message: backend === 'webgpu'
      ? 'Whisper Base wird für WebGPU geladen.'
      : 'Whisper Tiny wird für die CPU geladen.',
  })

  const instance = await pipeline('automatic-speech-recognition', model, {
    device: backend,
    dtype: backend === 'webgpu' ? 'q4' : 'q8',
    progress_callback: (value) => send(progressMessage(id, value)),
  })

  return {
    transcriber: instance as unknown as Transcriber,
    backend,
    model,
  }
}

async function getPipeline(id: string, forceWasm = false): Promise<LoadedPipeline> {
  if (forceWasm) loadedPipeline = null
  if (loadedPipeline) return loadedPipeline

  const webGpuAvailable = !forceWasm && typeof navigator !== 'undefined' && 'gpu' in navigator

  loadedPipeline = (async () => {
    if (webGpuAvailable) {
      try {
        return await createTranscriber(id, 'webgpu', PRIMARY_MODEL)
      } catch (error) {
        send({
          type: 'status',
          id,
          phase: 'fallback',
          backend: 'wasm',
          model: FALLBACK_MODEL,
          message: error instanceof Error
            ? `WebGPU nicht nutzbar (${error.message}). Wechsel auf CPU.`
            : 'WebGPU nicht nutzbar. Wechsel auf CPU.',
        })
      }
    }

    return createTranscriber(id, 'wasm', FALLBACK_MODEL)
  })()

  try {
    return await loadedPipeline
  } catch (error) {
    loadedPipeline = null
    throw error
  }
}

function extractText(output: TranscriptionOutput): string {
  if (Array.isArray(output)) return output.map((item) => item.text ?? '').join(' ').trim()
  return output.text?.trim() ?? ''
}

async function transcribe(request: SpeechWorkerRequest): Promise<void> {
  const startedAt = performance.now()
  let active = await getPipeline(request.id)

  send({
    type: 'status',
    id: request.id,
    phase: 'transcribing',
    backend: active.backend,
    model: active.model,
    message: 'Transkription läuft.',
  })

  let output: TranscriptionOutput
  try {
    output = await active.transcriber(request.audio, {
      language: 'german',
      task: 'transcribe',
      return_timestamps: false,
    })
  } catch (error) {
    if (active.backend !== 'webgpu') throw error

    send({
      type: 'status',
      id: request.id,
      phase: 'fallback',
      backend: 'wasm',
      model: FALLBACK_MODEL,
      message: 'WebGPU-Inferenz fehlgeschlagen. Erneuter Versuch auf der CPU.',
    })
    active = await getPipeline(request.id, true)
    output = await active.transcriber(request.audio, {
      language: 'german',
      task: 'transcribe',
      return_timestamps: false,
    })
  }

  const text = extractText(output)
  if (!text) throw new Error('Whisper hat keinen Text erkannt.')

  send({
    type: 'result',
    id: request.id,
    text,
    backend: active.backend,
    model: active.model,
    durationMs: Math.round(performance.now() - startedAt),
  })
}

self.addEventListener('message', (event: MessageEvent<SpeechWorkerRequest>) => {
  if (event.data.type !== 'transcribe') return

  void transcribe(event.data).catch((error) => {
    send({
      type: 'error',
      id: event.data.id,
      message: error instanceof Error ? error.message : 'Transkription fehlgeschlagen.',
    })
  })
})
