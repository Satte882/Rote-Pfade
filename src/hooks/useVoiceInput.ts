import { useEffect, useRef, useState } from 'react'
import { assessAudioQuality, audioBlobToMono16k } from '../lib/audio'
import { shouldRecommendBalancedProfile, type WarmPerformanceSample } from '../lib/speechPolicy'
import type {
  CachePersistence,
  CacheState,
  SpeechBackend,
  SpeechDiagnostics,
  SpeechPhase,
  SpeechProfile,
  SpeechWorkerMessage,
  SpeechWorkerRequest,
} from '../types/speech'

const PERSISTENCE_REQUEST_KEY = 'rote-pfade.speech-persistence-requested.v1'
const MODEL_READY_MARKER_KEY = 'rote-pfade.speech-model-ready.v1'
const CACHE_MISS_COUNT_KEY = 'rote-pfade.speech-cache-misses.v1'
const PREFERRED_PROFILE_KEY = 'rote-pfade.speech-profile.v1'
const PERFORMANCE_SAMPLES_KEY = 'rote-pfade.speech-performance.v1'
const TRANSFORMERS_CACHE_KEY = 'transformers-cache'
const RECORDING_TAIL_MS = 300

type PreferredProfile = Exclude<SpeechProfile, 'cpu-tiny-q8'>

function createRequestId(): string {
  return globalThis.crypto?.randomUUID?.() ?? `${Date.now()}-${Math.random()}`
}

function preferredMimeType(): string | undefined {
  if (typeof MediaRecorder === 'undefined') return undefined
  const candidates = [
    'audio/webm;codecs=opus',
    'audio/webm',
    'audio/ogg;codecs=opus',
    'audio/mp4',
  ]
  return candidates.find((candidate) => MediaRecorder.isTypeSupported(candidate))
}

function delay(milliseconds: number): Promise<void> {
  return new Promise((resolve) => globalThis.setTimeout(resolve, milliseconds))
}

function readNumber(key: string): number {
  const value = Number.parseInt(localStorage.getItem(key) ?? '0', 10)
  return Number.isFinite(value) ? value : 0
}

function loadPreferredProfile(): PreferredProfile {
  try {
    return localStorage.getItem(PREFERRED_PROFILE_KEY) === 'balanced-q8'
      ? 'balanced-q8'
      : 'quality-fp16-q8'
  } catch {
    return 'quality-fp16-q8'
  }
}

function loadPerformanceSamples(): WarmPerformanceSample[] {
  try {
    const parsed = JSON.parse(localStorage.getItem(PERFORMANCE_SAMPLES_KEY) ?? '[]') as unknown
    if (!Array.isArray(parsed)) return []
    return parsed
      .filter((item): item is WarmPerformanceSample => (
        typeof item === 'object'
        && item !== null
        && typeof (item as WarmPerformanceSample).inferenceMs === 'number'
        && typeof (item as WarmPerformanceSample).realtimeFactor === 'number'
      ))
      .slice(-5)
  } catch {
    return []
  }
}

function savePerformanceSample(sample: WarmPerformanceSample): WarmPerformanceSample[] {
  const samples = [...loadPerformanceSamples(), sample].slice(-5)
  try {
    localStorage.setItem(PERFORMANCE_SAMPLES_KEY, JSON.stringify(samples))
  } catch {
    // Performance diagnostics remain session-local when storage is unavailable.
  }
  return samples
}

async function inspectTransformersCache(): Promise<number | null> {
  if (!('caches' in globalThis)) return null
  try {
    const cache = await caches.open(TRANSFORMERS_CACHE_KEY)
    return (await cache.keys()).length
  } catch {
    return null
  }
}

async function requestPersistentModelCache(): Promise<CachePersistence> {
  if (!navigator.storage?.persist) return 'unsupported'

  try {
    if (await navigator.storage.persisted?.()) return 'persistent'
    if (!localStorage.getItem(PERSISTENCE_REQUEST_KEY)) {
      localStorage.setItem(PERSISTENCE_REQUEST_KEY, 'requested')
      if (await navigator.storage.persist()) return 'persistent'
    }
    return await navigator.storage.persisted?.() ? 'persistent' : 'best-effort'
  } catch {
    return 'best-effort'
  }
}

function stopStream(stream: MediaStream | null): void {
  stream?.getTracks().forEach((track) => track.stop())
}

function initialDiagnostics(): SpeechDiagnostics {
  return {
    backend: null,
    profile: null,
    model: null,
    cacheState: 'unknown',
    cacheEntries: null,
    cachePersistence: 'unknown',
    timings: null,
    audioQuality: null,
    performanceRecommendation: null,
  }
}

export type VoiceInputState = {
  phase: SpeechPhase
  status: string
  progress: number | null
  backend: SpeechBackend | null
  error: string
  supported: boolean
  diagnostics: SpeechDiagnostics
  preferredProfile: PreferredProfile
  startRecording: () => Promise<void>
  stopAndTranscribe: () => Promise<void>
  discard: () => void
  setPreferredProfile: (profile: PreferredProfile) => void
}

export function useVoiceInput(onTranscript: (text: string) => void): VoiceInputState {
  const [phase, setPhase] = useState<SpeechPhase>('idle')
  const [status, setStatus] = useState('')
  const [progress, setProgress] = useState<number | null>(null)
  const [backend, setBackend] = useState<SpeechBackend | null>(null)
  const [error, setError] = useState('')
  const [diagnostics, setDiagnostics] = useState<SpeechDiagnostics>(initialDiagnostics)
  const [preferredProfile, setPreferredProfileState] = useState<PreferredProfile>(loadPreferredProfile)

  const phaseRef = useRef<SpeechPhase>('idle')
  const diagnosticsRef = useRef<SpeechDiagnostics>(diagnostics)
  diagnosticsRef.current = diagnostics
  const workerRef = useRef<Worker | null>(null)
  const recorderRef = useRef<MediaRecorder | null>(null)
  const streamRef = useRef<MediaStream | null>(null)
  const chunksRef = useRef<Blob[]>([])
  const sessionIdRef = useRef<string | null>(null)
  const discardedRequestIdRef = useRef<string | null>(null)
  const operationVersionRef = useRef(0)
  const enterStartedAtRef = useRef(0)
  const tailMsRef = useRef(0)
  const audioPreparationMsRef = useRef(0)
  const transcriptCallbackRef = useRef(onTranscript)
  transcriptCallbackRef.current = onTranscript

  const setCurrentPhase = (next: SpeechPhase) => {
    phaseRef.current = next
    setPhase(next)
  }

  const supported =
    typeof navigator !== 'undefined'
    && Boolean(navigator.mediaDevices?.getUserMedia)
    && typeof MediaRecorder !== 'undefined'
    && typeof Worker !== 'undefined'
    && typeof AudioContext !== 'undefined'

  const updateCacheState = async (afterModelLoad = false): Promise<void> => {
    const cacheEntries = await inspectTransformersCache()
    let cacheState: CacheState = cacheEntries === null
      ? 'unsupported'
      : cacheEntries > 0
        ? 'present'
        : 'empty'

    try {
      const modelWasPreparedBefore = Boolean(localStorage.getItem(MODEL_READY_MARKER_KEY))
      let misses = readNumber(CACHE_MISS_COUNT_KEY)
      if (!afterModelLoad && modelWasPreparedBefore && cacheEntries === 0) {
        misses += 1
        localStorage.setItem(CACHE_MISS_COUNT_KEY, String(misses))
      }
      if (misses >= 2) cacheState = 'unreliable'
      if (afterModelLoad && cacheEntries && cacheEntries > 0) {
        localStorage.setItem(MODEL_READY_MARKER_KEY, new Date().toISOString())
      }
    } catch {
      // Cache inspection remains informative without local markers.
    }

    setDiagnostics((current) => ({ ...current, cacheEntries, cacheState }))
  }

  const ensureWorker = (): Worker => {
    if (workerRef.current) return workerRef.current

    const worker = new Worker(new URL('../workers/transcription.worker.ts', import.meta.url), {
      type: 'module',
    })

    worker.addEventListener('message', (event: MessageEvent<SpeechWorkerMessage>) => {
      const message = event.data
      if (message.id !== sessionIdRef.current) return

      if (message.type === 'progress') {
        const nextProgress = typeof message.progress === 'number'
          ? Math.max(0, Math.min(100, Math.round(message.progress)))
          : message.loaded && message.total
            ? Math.max(0, Math.min(100, Math.round((message.loaded / message.total) * 100)))
            : null
        setProgress(nextProgress)
        if (discardedRequestIdRef.current === message.id) return
        const progressText = nextProgress === null ? 'Modell wird geladen' : `Modell wird geladen · ${nextProgress}%`
        if (phaseRef.current === 'recording' || phaseRef.current === 'finishing-recording') {
          setStatus(`Aufnahme läuft · ${progressText}`)
        } else {
          setCurrentPhase('loading-model')
          setStatus(progressText)
        }
        return
      }

      if (message.type === 'status') {
        if (message.backend) setBackend(message.backend)
        setDiagnostics((current) => ({
          ...current,
          backend: message.backend ?? current.backend,
          profile: message.profile ?? current.profile,
          model: message.model ?? current.model,
        }))
        if (discardedRequestIdRef.current === message.id) return
        setProgress(null)
        if (phaseRef.current === 'recording' || phaseRef.current === 'finishing-recording') {
          setStatus(`Aufnahme läuft · ${message.message}`)
        } else {
          setCurrentPhase(message.phase === 'transcribing' ? 'transcribing' : 'loading-model')
          setStatus(message.message)
        }
        return
      }

      if (message.type === 'ready') {
        setBackend(message.backend)
        setProgress(null)
        setDiagnostics((current) => ({
          ...current,
          backend: message.backend,
          profile: message.profile,
          model: message.model,
          timings: current.timings
            ? { ...current.timings, modelLoadMs: message.reused ? 0 : message.modelLoadMs }
            : current.timings,
        }))
        void updateCacheState(true)
        if (phaseRef.current === 'recording') setStatus('Aufnahme läuft · Modell bereit')
        return
      }

      if (message.type === 'result') {
        const discarded = discardedRequestIdRef.current === message.id
        const totalAfterEnterMs = enterStartedAtRef.current > 0
          ? Math.round(performance.now() - enterStartedAtRef.current)
          : message.totalWorkerMs
        sessionIdRef.current = null
        discardedRequestIdRef.current = null
        setProgress(null)
        setBackend(message.backend)
        setCurrentPhase('idle')

        let performanceRecommendation: SpeechDiagnostics['performanceRecommendation'] = null
        const currentQuality = diagnosticsRef.current.audioQuality
        if (
          message.profile === 'quality-fp16-q8'
          && message.modelWaitMs < 500
          && currentQuality?.benchmarkEligible
        ) {
          const samples = savePerformanceSample({
            inferenceMs: message.inferenceMs,
            realtimeFactor: message.realtimeFactor,
          })
          if (shouldRecommendBalancedProfile(samples)) performanceRecommendation = 'balanced-q8'
        }

        setDiagnostics((current) => ({
          ...current,
          backend: message.backend,
          profile: message.profile,
          model: message.model,
          performanceRecommendation,
          timings: {
            tailMs: tailMsRef.current,
            audioPreparationMs: audioPreparationMsRef.current,
            modelWaitMs: message.modelWaitMs,
            modelLoadMs: message.modelLoadMs,
            inferenceMs: message.inferenceMs,
            totalAfterEnterMs,
            audioDurationMs: message.audioDurationMs,
            realtimeFactor: message.realtimeFactor,
          },
        }))

        const seconds = (totalAfterEnterMs / 1_000).toFixed(1).replace('.', ',')
        setStatus(discarded ? '' : `Lokal transkribiert · ${message.backend.toUpperCase()} · ${seconds} s`)
        if (!discarded) transcriptCallbackRef.current(message.text)
        return
      }

      const discarded = discardedRequestIdRef.current === message.id
      sessionIdRef.current = null
      discardedRequestIdRef.current = null
      setProgress(null)
      setCurrentPhase(discarded ? 'idle' : 'error')
      setError(discarded ? '' : message.message)
      setStatus('')
    })

    worker.addEventListener('error', (event) => {
      sessionIdRef.current = null
      discardedRequestIdRef.current = null
      setProgress(null)
      setCurrentPhase('error')
      setError(event.message || 'Der Transkriptions-Worker ist fehlgeschlagen.')
      setStatus('')
      worker.terminate()
      workerRef.current = null
    })

    workerRef.current = worker
    return worker
  }

  const cleanupRecorder = (): void => {
    recorderRef.current = null
    stopStream(streamRef.current)
    streamRef.current = null
  }

  const startRecording = async (): Promise<void> => {
    if (!supported || phaseRef.current === 'recording' || sessionIdRef.current) return

    const operationVersion = ++operationVersionRef.current
    setError('')
    setProgress(null)
    setStatus('Mikrofonzugriff wird angefragt.')
    setCurrentPhase('requesting-permission')
    setDiagnostics((current) => ({
      ...current,
      timings: null,
      audioQuality: null,
      performanceRecommendation: null,
    }))

    void updateCacheState(false)
    void requestPersistentModelCache().then((cachePersistence) => {
      setDiagnostics((current) => ({ ...current, cachePersistence }))
    })

    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: false,
        audio: {
          echoCancellation: true,
          noiseSuppression: true,
          autoGainControl: true,
        },
      })

      if (operationVersion !== operationVersionRef.current) {
        stopStream(stream)
        return
      }

      const mimeType = preferredMimeType()
      const recorder = new MediaRecorder(stream, mimeType ? { mimeType } : undefined)
      const id = createRequestId()

      sessionIdRef.current = id
      streamRef.current = stream
      recorderRef.current = recorder
      chunksRef.current = []
      recorder.addEventListener('dataavailable', (event) => {
        if (event.data.size > 0) chunksRef.current.push(event.data)
      })
      recorder.addEventListener('error', () => {
        cleanupRecorder()
        sessionIdRef.current = null
        setCurrentPhase('error')
        setError('Die Audioaufnahme ist fehlgeschlagen.')
        setStatus('')
      })
      recorder.start()
      setCurrentPhase('recording')
      setStatus('Aufnahme läuft · Modell wird parallel vorbereitet')

      const request: SpeechWorkerRequest = {
        type: 'prepare',
        id,
        preferredProfile,
      }
      ensureWorker().postMessage(request)
    } catch (recordingError) {
      cleanupRecorder()
      if (operationVersion !== operationVersionRef.current) return
      setCurrentPhase('error')
      setStatus('')
      setError(
        recordingError instanceof Error
          ? `Mikrofon nicht verfügbar: ${recordingError.message}`
          : 'Mikrofon nicht verfügbar.',
      )
    }
  }

  const stopAndTranscribe = async (): Promise<void> => {
    const recorder = recorderRef.current
    const id = sessionIdRef.current
    if (!recorder || !id || recorder.state === 'inactive' || phaseRef.current !== 'recording') return

    const operationVersion = ++operationVersionRef.current
    enterStartedAtRef.current = performance.now()
    const tailStartedAt = performance.now()
    setCurrentPhase('finishing-recording')
    setStatus(`Aufnahme endet · ${RECORDING_TAIL_MS} ms Nachlauf`)
    setError('')

    try {
      await delay(RECORDING_TAIL_MS)
      if (operationVersion !== operationVersionRef.current) return
      tailMsRef.current = Math.round(performance.now() - tailStartedAt)
      setCurrentPhase('preparing-audio')
      setStatus('Audio wird vorbereitet.')
      const audioPreparationStartedAt = performance.now()

      const blob = await new Promise<Blob>((resolve, reject) => {
        recorder.addEventListener('stop', () => {
          resolve(new Blob(chunksRef.current, { type: recorder.mimeType || 'audio/webm' }))
        }, { once: true })
        recorder.addEventListener('error', () => reject(new Error('Aufnahme konnte nicht beendet werden.')), { once: true })
        recorder.stop()
      })
      cleanupRecorder()
      chunksRef.current = []

      const audio = await audioBlobToMono16k(blob)
      audioPreparationMsRef.current = Math.round(performance.now() - audioPreparationStartedAt)
      if (operationVersion !== operationVersionRef.current) return
      if (audio.length < 1_600) throw new Error('Die Aufnahme ist zu kurz oder enthält keine erkennbare Sprache.')

      const audioQuality = assessAudioQuality(audio)
      diagnosticsRef.current = { ...diagnosticsRef.current, audioQuality }
      setDiagnostics((current) => ({ ...current, audioQuality }))
      setCurrentPhase('loading-model')
      setStatus('Transkription wird gestartet.')
      const request: SpeechWorkerRequest = {
        type: 'transcribe',
        id,
        audio,
        audioDurationMs: audioQuality.durationMs,
        preferredProfile,
      }
      ensureWorker().postMessage(request, [audio.buffer])
    } catch (processingError) {
      cleanupRecorder()
      chunksRef.current = []
      sessionIdRef.current = null
      if (operationVersion !== operationVersionRef.current) return
      setCurrentPhase('error')
      setStatus('')
      setError(
        processingError instanceof Error
          ? processingError.message
          : 'Audio konnte nicht transkribiert werden.',
      )
    }
  }

  const discard = (): void => {
    operationVersionRef.current += 1
    setError('')
    setProgress(null)

    if (
      phaseRef.current === 'recording'
      || phaseRef.current === 'requesting-permission'
      || phaseRef.current === 'finishing-recording'
    ) {
      const recorder = recorderRef.current
      if (recorder?.state === 'recording') recorder.stop()
      chunksRef.current = []
      cleanupRecorder()
      sessionIdRef.current = null
      setCurrentPhase('idle')
      setStatus('')
      return
    }

    if (phaseRef.current === 'preparing-audio') {
      sessionIdRef.current = null
      setCurrentPhase('idle')
      setStatus('')
      return
    }

    if (sessionIdRef.current) {
      discardedRequestIdRef.current = sessionIdRef.current
      setCurrentPhase('discarded')
      setStatus('Transkription verworfen · Restverarbeitung endet')
    }
  }

  const setPreferredProfile = (profile: PreferredProfile): void => {
    setPreferredProfileState(profile)
    setDiagnostics((current) => ({ ...current, performanceRecommendation: null }))
    try {
      localStorage.setItem(PREFERRED_PROFILE_KEY, profile)
    } catch {
      // The selection remains active for the current session.
    }
  }

  useEffect(() => () => {
    operationVersionRef.current += 1
    if (recorderRef.current?.state === 'recording') recorderRef.current.stop()
    cleanupRecorder()
    workerRef.current?.terminate()
    workerRef.current = null
  }, [])

  return {
    phase,
    status,
    progress,
    backend,
    error,
    supported,
    diagnostics,
    preferredProfile,
    startRecording,
    stopAndTranscribe,
    discard,
    setPreferredProfile,
  }
}
