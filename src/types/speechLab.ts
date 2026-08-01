export type SpeechLabProfileId =
  | 'base-q4-webgpu'
  | 'base-q8-webgpu'
  | 'base-fp16-q8-webgpu'
  | 'tiny-q8-webgpu'
  | 'tiny-q8-wasm'

export type SpeechLabProfile = {
  id: SpeechLabProfileId
  label: string
  model: string
  backend: 'webgpu' | 'wasm'
  diagnosticOnly?: boolean
}

export type SpeechLabRunRequest = {
  type: 'run'
  id: string
  profile: SpeechLabProfileId
  audio: Float32Array
  audioDurationMs: number
}

export type SpeechLabWorkerRequest = SpeechLabRunRequest

export type SpeechLabProgressMessage = {
  type: 'progress'
  id: string
  profile: SpeechLabProfileId
  progress: number | null
  message: string
}

export type SpeechLabResultMessage = {
  type: 'result'
  id: string
  profile: SpeechLabProfileId
  model: string
  backend: 'webgpu' | 'wasm'
  modelLoadMs: number
  firstInferenceMs: number
  warmInferenceMs: number
  firstTranscript: string
  warmTranscript: string
  audioDurationMs: number
}

export type SpeechLabErrorMessage = {
  type: 'error'
  id: string
  profile: SpeechLabProfileId
  message: string
}

export type SpeechLabWorkerMessage =
  | SpeechLabProgressMessage
  | SpeechLabResultMessage
  | SpeechLabErrorMessage

export type AudioValidation = {
  blobSize: number
  mimeType: string
  chunkCount: number
  wallDurationMs: number | null
  decodedDurationMs: number
  durationRatio: number | null
  decodedSampleRate: number
  captureSampleRate: number | null
  channels: number
  pcmSamples: number
  rmsDbfs: number
  peakDbfs: number
  nearZeroRatio: number
  leadingSilenceMs: number
  trailingSilenceMs: number
  eligible: boolean
  warnings: string[]
}

export type SpeechLabRunResult = SpeechLabResultMessage & {
  firstWer: number
  warmWer: number
  warmRealtimeFactor: number
  latencyPass: boolean
  qualityPass: boolean
}
