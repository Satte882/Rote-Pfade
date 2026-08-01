import { useEffect, useRef, useState } from 'react'
import { audioBlobToMono16k } from '../lib/audio'
import type {
  SpeechBackend,
  SpeechPhase,
  SpeechWorkerMessage,
  SpeechWorkerRequest,
} from '../types/speech'

const PERSISTENCE_REQUEST_KEY = 'rote-pfade.speech-persistence-requested.v1'

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

async function requestPersistentModelCache(): Promise<void> {
  if (!navigator.storage?.persist || localStorage.getItem(PERSISTENCE_REQUEST_KEY)) return
  localStorage.setItem(PERSISTENCE_REQUEST_KEY, 'requested')

  try {
    const alreadyPersistent = await navigator.storage.persisted?.()
    if (!alreadyPersistent) await navigator.storage.persist()
  } catch {
    // Browser caching remains best effort when persistence is unavailable or denied.
  }
}

function stopStream(stream: MediaStream | null): void {
  stream?.getTracks().forEach((track) => track.stop())
}

export type VoiceInputState = {
  phase: SpeechPhase
  status: string
  progress: number | null
  backend: SpeechBackend | null
  error: string
  supported: boolean
  startRecording: () => Promise<void>
  stopAndTranscribe: () => Promise<void>
  discard: () => void
}

export function useVoiceInput(onTranscript: (text: string) => void): VoiceInputState {
  const [phase, setPhase] = useState<SpeechPhase>('idle')
  const [status, setStatus] = useState('')
  const [progress, setProgress] = useState<number | null>(null)
  const [backend, setBackend] = useState<SpeechBackend | null>(null)
  const [error, setError] = useState('')

  const workerRef = useRef<Worker | null>(null)
  const recorderRef = useRef<MediaRecorder | null>(null)
  const streamRef = useRef<MediaStream | null>(null)
  const chunksRef = useRef<Blob[]>([])
  const activeRequestIdRef = useRef<string | null>(null)
  const discardedRequestIdRef = useRef<string | null>(null)
  const operationVersionRef = useRef(0)
  const transcriptCallbackRef = useRef(onTranscript)
  transcriptCallbackRef.current = onTranscript

  const supported =
    typeof navigator !== 'undefined'
    && Boolean(navigator.mediaDevices?.getUserMedia)
    && typeof MediaRecorder !== 'undefined'
    && typeof Worker !== 'undefined'
    && typeof AudioContext !== 'undefined'

  const ensureWorker = (): Worker => {
    if (workerRef.current) return workerRef.current

    const worker = new Worker(new URL('../workers/transcription.worker.ts', import.meta.url), {
      type: 'module',
    })

    worker.addEventListener('message', (event: MessageEvent<SpeechWorkerMessage>) => {
      const message = event.data
      if (message.id !== activeRequestIdRef.current) return

      if (message.type === 'progress') {
        const nextProgress = typeof message.progress === 'number'
          ? Math.max(0, Math.min(100, Math.round(message.progress)))
          : message.loaded && message.total
            ? Math.max(0, Math.min(100, Math.round((message.loaded / message.total) * 100)))
            : null
        setProgress(nextProgress)
        if (discardedRequestIdRef.current !== message.id) {
          setPhase('loading-model')
          setStatus(nextProgress === null ? 'Modell wird geladen.' : `Modell wird geladen · ${nextProgress}%`)
        }
        return
      }

      if (message.type === 'status') {
        if (message.backend) setBackend(message.backend)
        if (discardedRequestIdRef.current === message.id) return
        setProgress(null)
        setPhase(message.phase === 'transcribing' ? 'transcribing' : 'loading-model')
        setStatus(message.message)
        return
      }

      if (message.type === 'result') {
        const discarded = discardedRequestIdRef.current === message.id
        activeRequestIdRef.current = null
        discardedRequestIdRef.current = null
        setProgress(null)
        setBackend(message.backend)
        setPhase('idle')
        setStatus(discarded ? '' : `Lokal transkribiert · ${message.backend.toUpperCase()}`)
        if (!discarded) transcriptCallbackRef.current(message.text)
        return
      }

      const discarded = discardedRequestIdRef.current === message.id
      activeRequestIdRef.current = null
      discardedRequestIdRef.current = null
      setProgress(null)
      setPhase(discarded ? 'idle' : 'error')
      setError(discarded ? '' : message.message)
      setStatus('')
    })

    worker.addEventListener('error', (event) => {
      activeRequestIdRef.current = null
      discardedRequestIdRef.current = null
      setProgress(null)
      setPhase('error')
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
    if (!supported || phase === 'recording' || activeRequestIdRef.current) return

    const operationVersion = ++operationVersionRef.current
    setError('')
    setProgress(null)
    setStatus('Mikrofonzugriff wird angefragt.')
    setPhase('requesting-permission')
    void requestPersistentModelCache()

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

      streamRef.current = stream
      recorderRef.current = recorder
      chunksRef.current = []
      recorder.addEventListener('dataavailable', (event) => {
        if (event.data.size > 0) chunksRef.current.push(event.data)
      })
      recorder.addEventListener('error', () => {
        cleanupRecorder()
        setPhase('error')
        setError('Die Audioaufnahme ist fehlgeschlagen.')
        setStatus('')
      })
      recorder.start()
      setPhase('recording')
      setStatus('Aufnahme läuft · Enter beendet')
    } catch (recordingError) {
      cleanupRecorder()
      if (operationVersion !== operationVersionRef.current) return
      setPhase('error')
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
    if (!recorder || recorder.state === 'inactive' || phase !== 'recording') return

    const operationVersion = ++operationVersionRef.current
    setPhase('preparing-audio')
    setStatus('Audio wird vorbereitet.')
    setError('')

    try {
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
      if (operationVersion !== operationVersionRef.current) return
      if (audio.length < 1_600) throw new Error('Die Aufnahme ist zu kurz oder enthält keine erkennbare Sprache.')

      const id = createRequestId()
      activeRequestIdRef.current = id
      discardedRequestIdRef.current = null
      setPhase('loading-model')
      setStatus('Lokales Sprachmodell wird vorbereitet.')
      const request: SpeechWorkerRequest = { type: 'transcribe', id, audio }
      ensureWorker().postMessage(request, [audio.buffer])
    } catch (processingError) {
      cleanupRecorder()
      chunksRef.current = []
      if (operationVersion !== operationVersionRef.current) return
      setPhase('error')
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

    if (phase === 'recording' || phase === 'requesting-permission') {
      const recorder = recorderRef.current
      if (recorder?.state === 'recording') recorder.stop()
      chunksRef.current = []
      cleanupRecorder()
      setPhase('idle')
      setStatus('')
      return
    }

    if (phase === 'preparing-audio') {
      setPhase('idle')
      setStatus('')
      return
    }

    if (activeRequestIdRef.current) {
      discardedRequestIdRef.current = activeRequestIdRef.current
      setPhase('discarded')
      setStatus('Transkription verworfen · Restverarbeitung endet')
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
    startRecording,
    stopAndTranscribe,
    discard,
  }
}
