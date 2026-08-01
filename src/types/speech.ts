export type SpeechBackend = 'webgpu' | 'wasm'

export type SpeechPhase =
  | 'idle'
  | 'requesting-permission'
  | 'recording'
  | 'preparing-audio'
  | 'loading-model'
  | 'transcribing'
  | 'error'

export type SpeechWorkerRequest = {
  type: 'transcribe'
  id: string
  audio: Float32Array
}

export type SpeechProgressMessage = {
  type: 'progress'
  id: string
  status?: string
  file?: string
  progress?: number
  loaded?: number
  total?: number
}

export type SpeechStatusMessage = {
  type: 'status'
  id: string
  phase: 'loading-model' | 'transcribing' | 'fallback'
  backend?: SpeechBackend
  model?: string
  message: string
}

export type SpeechResultMessage = {
  type: 'result'
  id: string
  text: string
  backend: SpeechBackend
  model: string
  durationMs: number
}

export type SpeechErrorMessage = {
  type: 'error'
  id: string
  message: string
}

export type SpeechWorkerMessage =
  | SpeechProgressMessage
  | SpeechStatusMessage
  | SpeechResultMessage
  | SpeechErrorMessage
