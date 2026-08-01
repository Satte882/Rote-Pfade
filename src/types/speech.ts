export type SpeechPhase =
  | 'idle'
  | 'checking-model'
  | 'installing-model'
  | 'recording'
  | 'stopping'
  | 'error'

export type LocalSpeechAvailability =
  | 'unknown'
  | 'available'
  | 'downloadable'
  | 'downloading'
  | 'unavailable'

export type NativeSpeechDiagnostics = {
  engine: 'edge-local' | null
  language: 'de-DE'
  availability: LocalSpeechAvailability
  recognitionMs: number | null
  confidence: number | null
}
