import { useEffect, useRef, useState } from 'react'
import type {
  LocalSpeechAvailability,
  NativeSpeechDiagnostics,
  SpeechPhase,
} from '../types/speech'

const LANGUAGE = 'de-DE' as const

type LocalSpeechOptions = {
  langs: string[]
  processLocally: true
  quality?: 'dictation'
}

type RecognitionAlternativeLike = {
  transcript: string
  confidence: number
}

type RecognitionResultLike = {
  isFinal: boolean
  length: number
  [index: number]: RecognitionAlternativeLike
}

type RecognitionResultListLike = {
  length: number
  [index: number]: RecognitionResultLike
}

type RecognitionEventLike = Event & {
  resultIndex: number
  results: RecognitionResultListLike
}

type RecognitionErrorEventLike = Event & {
  error: string
  message?: string
}

type RecognitionLike = {
  lang: string
  continuous: boolean
  interimResults: boolean
  maxAlternatives: number
  processLocally: boolean
  onstart: (() => void) | null
  onresult: ((event: RecognitionEventLike) => void) | null
  onerror: ((event: RecognitionErrorEventLike) => void) | null
  onend: (() => void) | null
  start: () => void
  stop: () => void
  abort: () => void
}

type RecognitionConstructor = {
  new (): RecognitionLike
  available?: (options: LocalSpeechOptions) => Promise<LocalSpeechAvailability>
  install?: (options: LocalSpeechOptions) => Promise<boolean>
}

type SpeechWindow = Window & {
  SpeechRecognition?: RecognitionConstructor
  webkitSpeechRecognition?: RecognitionConstructor
}

function getRecognitionConstructor(): RecognitionConstructor | null {
  if (typeof window === 'undefined') return null
  const speechWindow = window as SpeechWindow
  return speechWindow.SpeechRecognition ?? speechWindow.webkitSpeechRecognition ?? null
}

function bestAlternative(result: RecognitionResultLike): RecognitionAlternativeLike | null {
  let best: RecognitionAlternativeLike | null = null
  for (let index = 0; index < result.length; index += 1) {
    const candidate = result[index]
    if (!best || candidate.confidence > best.confidence) best = candidate
  }
  return best
}

function cleanTranscript(parts: readonly string[]): string {
  return parts
    .join(' ')
    .replace(/\s+/g, ' ')
    .trim()
}

function errorMessage(error: string): string {
  if (error === 'not-allowed' || error === 'service-not-allowed') {
    return 'Mikrofonzugriff wurde nicht erlaubt.'
  }
  if (error === 'audio-capture') return 'Kein verwendbares Mikrofon gefunden.'
  if (error === 'no-speech') return 'Keine Sprache erkannt. Bitte erneut sprechen.'
  if (error === 'language-not-supported') {
    return 'Das lokale deutsche Sprachmodell ist nicht installiert oder in diesem Browser nicht verfügbar.'
  }
  if (error === 'network') {
    return 'Die lokale Spracherkennung konnte nicht gestartet werden. Es wird kein Cloud-Fallback verwendet.'
  }
  if (error === 'aborted') return ''
  return `Lokale Spracherkennung fehlgeschlagen: ${error}`
}

async function checkAvailability(
  Constructor: RecognitionConstructor,
): Promise<LocalSpeechAvailability> {
  if (!Constructor.available) return 'unavailable'

  try {
    return await Constructor.available({
      langs: [LANGUAGE],
      processLocally: true,
      quality: 'dictation',
    })
  } catch {
    return Constructor.available({ langs: [LANGUAGE], processLocally: true })
  }
}

async function installLanguagePack(Constructor: RecognitionConstructor): Promise<boolean> {
  if (!Constructor.install) return false

  try {
    return await Constructor.install({
      langs: [LANGUAGE],
      processLocally: true,
      quality: 'dictation',
    })
  } catch {
    return Constructor.install({ langs: [LANGUAGE], processLocally: true })
  }
}

export type VoiceInputState = {
  phase: SpeechPhase
  status: string
  error: string
  supported: boolean
  interimText: string
  diagnostics: NativeSpeechDiagnostics
  startRecording: () => Promise<void>
  stopAndTranscribe: () => Promise<void>
  discard: () => void
}

const initialDiagnostics: NativeSpeechDiagnostics = {
  engine: null,
  language: LANGUAGE,
  availability: 'unknown',
  recognitionMs: null,
  confidence: null,
}

export function useVoiceInput(onTranscript: (text: string) => void): VoiceInputState {
  const [phase, setPhase] = useState<SpeechPhase>('idle')
  const [status, setStatus] = useState('')
  const [error, setError] = useState('')
  const [interimText, setInterimText] = useState('')
  const [diagnostics, setDiagnostics] = useState<NativeSpeechDiagnostics>(initialDiagnostics)

  const recognitionRef = useRef<RecognitionLike | null>(null)
  const finalPartsRef = useRef<string[]>([])
  const interimRef = useRef('')
  const confidenceRef = useRef<number[]>([])
  const discardedRef = useRef(false)
  const stopStartedAtRef = useRef(0)
  const transcriptCallbackRef = useRef(onTranscript)
  transcriptCallbackRef.current = onTranscript

  const Constructor = getRecognitionConstructor()
  const supported = Boolean(Constructor)

  const finish = (recognition: RecognitionLike): void => {
    if (recognitionRef.current === recognition) recognitionRef.current = null

    if (discardedRef.current) {
      discardedRef.current = false
      finalPartsRef.current = []
      interimRef.current = ''
      confidenceRef.current = []
      setInterimText('')
      setPhase('idle')
      setStatus('')
      return
    }

    const text = cleanTranscript(
      finalPartsRef.current.length > 0 ? finalPartsRef.current : [interimRef.current],
    )
    const recognitionMs = stopStartedAtRef.current > 0
      ? Math.round(performance.now() - stopStartedAtRef.current)
      : null
    const confidence = confidenceRef.current.length > 0
      ? confidenceRef.current.reduce((sum, value) => sum + value, 0) / confidenceRef.current.length
      : null

    finalPartsRef.current = []
    interimRef.current = ''
    confidenceRef.current = []
    setInterimText('')
    setPhase(text ? 'idle' : 'error')
    setDiagnostics((current) => ({
      ...current,
      engine: 'edge-local',
      recognitionMs,
      confidence,
    }))

    if (!text) {
      setStatus('')
      setError('Keine verwertbare Sprache erkannt. Bitte erneut versuchen.')
      return
    }

    const duration = recognitionMs === null
      ? ''
      : ` · ${(recognitionMs / 1_000).toFixed(1).replace('.', ',')} s`
    setError('')
    setStatus(`Lokal erkannt · EDGE${duration}`)
    transcriptCallbackRef.current(text)
  }

  const startRecording = async (): Promise<void> => {
    if (!Constructor || recognitionRef.current) return

    setError('')
    setStatus('Lokales deutsches Sprachmodell wird geprüft.')
    setPhase('checking-model')
    setInterimText('')
    setDiagnostics(initialDiagnostics)

    try {
      let availability = await checkAvailability(Constructor)
      setDiagnostics((current) => ({ ...current, availability }))

      if (availability === 'downloadable' || availability === 'downloading') {
        setPhase('installing-model')
        setStatus('Lokales deutsches Sprachmodell wird einmalig installiert.')
        const installed = await installLanguagePack(Constructor)
        if (!installed) throw new Error('Das lokale deutsche Sprachmodell konnte nicht installiert werden.')
        availability = 'available'
        setDiagnostics((current) => ({ ...current, availability }))
      }

      if (availability !== 'available') {
        throw new Error(
          'Lokale deutsche Spracherkennung ist in diesem Browser nicht verfügbar. In Edge 150+ gegebenenfalls unter edge://flags „Speech Recognition with on-device model“ aktivieren.',
        )
      }

      const recognition = new Constructor()
      if (!('processLocally' in recognition)) {
        throw new Error('Dieser Browser unterstützt keine verbindlich lokale Spracherkennung.')
      }

      recognition.lang = LANGUAGE
      recognition.processLocally = true
      recognition.continuous = true
      recognition.interimResults = true
      recognition.maxAlternatives = 3

      finalPartsRef.current = []
      interimRef.current = ''
      confidenceRef.current = []
      discardedRef.current = false
      stopStartedAtRef.current = 0

      recognition.onstart = () => {
        setPhase('recording')
        setStatus('Aufnahme läuft · Enter beendet')
        setDiagnostics((current) => ({
          ...current,
          engine: 'edge-local',
          availability: 'available',
        }))
      }

      recognition.onresult = (event) => {
        let latestInterim = ''
        for (let index = event.resultIndex; index < event.results.length; index += 1) {
          const result = event.results[index]
          const alternative = bestAlternative(result)
          if (!alternative) continue
          const text = alternative.transcript.trim()
          if (!text) continue

          if (result.isFinal) {
            finalPartsRef.current.push(text)
            if (Number.isFinite(alternative.confidence)) confidenceRef.current.push(alternative.confidence)
          } else {
            latestInterim = text
          }
        }

        interimRef.current = latestInterim
        setInterimText(latestInterim)
        if (latestInterim) setStatus(`Aufnahme läuft · ${latestInterim}`)
      }

      recognition.onerror = (event) => {
        const message = errorMessage(event.error)
        if (!message || discardedRef.current) return
        setPhase('error')
        setStatus('')
        setError(message)
      }

      recognition.onend = () => finish(recognition)
      recognitionRef.current = recognition
      recognition.start()
    } catch (startError) {
      recognitionRef.current = null
      setPhase('error')
      setStatus('')
      setError(startError instanceof Error ? startError.message : 'Lokale Spracherkennung konnte nicht gestartet werden.')
    }
  }

  const stopAndTranscribe = async (): Promise<void> => {
    const recognition = recognitionRef.current
    if (!recognition || phase !== 'recording') return
    stopStartedAtRef.current = performance.now()
    setPhase('stopping')
    setStatus('Erkennung wird abgeschlossen.')
    recognition.stop()
  }

  const discard = (): void => {
    const recognition = recognitionRef.current
    discardedRef.current = true
    setError('')
    setInterimText('')
    if (recognition) recognition.abort()
    else {
      discardedRef.current = false
      setPhase('idle')
      setStatus('')
    }
  }

  useEffect(() => () => {
    discardedRef.current = true
    recognitionRef.current?.abort()
    recognitionRef.current = null
  }, [])

  return {
    phase,
    status,
    error,
    supported,
    interimText,
    diagnostics,
    startRecording,
    stopAndTranscribe,
    discard,
  }
}
