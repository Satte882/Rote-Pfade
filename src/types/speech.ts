export type SpeechBackend = 'webgpu' | 'wasm'
export type SpeechProfile = 'quality-fp16-q8' | 'balanced-q8' | 'cpu-tiny-q8'
export type CacheState = 'unknown' | 'empty' | 'present' | 'unreliable' | 'unsupported'
export type CachePersistence = 'unknown' | 'persistent' | 'best-effort' | 'unsupported'

export type SpeechPhase =
  | 'idle'
  | 'requesting-permission'
  | 'recording'
  | 'finishing-recording'
  | 'preparing-audio'
  | 'loading-model'
  | 'transcribing'
  | 'discarded'
  | 'error'

export type AudioQualityLevel = 'good' | 'warning' | 'poor'

export type AudioQuality = {
  level: AudioQualityLevel
  durationMs: number
  rmsDbfs: number
  peakDbfs: number
  clippingRatio: number
  silenceRatio: number
  benchmarkEligible: boolean
  warnings: string[]
}

export type SpeechTimings = {
  tailMs: number
  audioPreparationMs: number
  modelWaitMs: number
  modelLoadMs: number
  inferenceMs: number
  totalAfterEnterMs: number
  audioDurationMs: number
  realtimeFactor: number
}

export type SpeechDiagnostics = {
  backend: SpeechBackend | null
  profile: SpeechProfile | null
  model: string | null
  cacheState: CacheState
  cacheEntries: number | null
  cachePersistence: CachePersistence
  timings: SpeechTimings | null
  audioQuality: AudioQuality | null
  performanceRecommendation: 'balanced-q8' | null
}

export type SpeechPrepareRequest = {
  type: 'prepare'
  id: string
  preferredProfile: Exclude<SpeechProfile, 'cpu-tiny-q8'>
}

export type SpeechTranscribeRequest = {
  type: 'transcribe'
  id: string
  audio: Float32Array
  audioDurationMs: number
  preferredProfile: Exclude<SpeechProfile, 'cpu-tiny-q8'>
}

export type SpeechWorkerRequest = SpeechPrepareRequest | SpeechTranscribeRequest

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
  profile?: SpeechProfile
  model?: string
  message: string
}

export type SpeechReadyMessage = {
  type: 'ready'
  id: string
  backend: SpeechBackend
  profile: SpeechProfile
  model: string
  modelLoadMs: number
  reused: boolean
}

export type SpeechResultMessage = {
  type: 'result'
  id: string
  text: string
  backend: SpeechBackend
  profile: SpeechProfile
  model: string
  modelWaitMs: number
  modelLoadMs: number
  inferenceMs: number
  totalWorkerMs: number
  audioDurationMs: number
  realtimeFactor: number
}

export type SpeechErrorMessage = {
  type: 'error'
  id: string
  message: string
}

export type SpeechWorkerMessage =
  | SpeechProgressMessage
  | SpeechStatusMessage
  | SpeechReadyMessage
  | SpeechResultMessage
  | SpeechErrorMessage
