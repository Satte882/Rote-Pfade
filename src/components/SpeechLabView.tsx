import { useEffect, useMemo, useRef, useState } from 'react'
import {
  decodeValidateAndPrepare,
  isReferenceDuration,
  latencyPass,
  shouldAbandonBrowserBaseline,
  wordErrorRate,
} from '../lib/speechLab'
import type {
  AudioValidation,
  SpeechLabProfile,
  SpeechLabProfileId,
  SpeechLabRunResult,
  SpeechLabWorkerMessage,
} from '../types/speechLab'

const DEFAULT_REFERENCE = 'Wie würdest du eine Make-or-Buy-Entscheidung treffen?'

const PROFILES: SpeechLabProfile[] = [
  {
    id: 'base-q4-webgpu',
    label: 'Baseline · Base q4/q4 · WebGPU',
    model: 'onnx-community/whisper-base',
    backend: 'webgpu',
  },
  {
    id: 'base-q8-webgpu',
    label: 'Base q8/q8 · WebGPU',
    model: 'onnx-community/whisper-base',
    backend: 'webgpu',
  },
  {
    id: 'base-fp16-q8-webgpu',
    label: 'Base FP16/q8 · WebGPU',
    model: 'onnx-community/whisper-base',
    backend: 'webgpu',
  },
  {
    id: 'tiny-q8-webgpu',
    label: 'Diagnose · Tiny q8 · WebGPU',
    model: 'onnx-community/whisper-tiny',
    backend: 'webgpu',
    diagnosticOnly: true,
  },
  {
    id: 'tiny-q8-wasm',
    label: 'Diagnose · Tiny q8 · WASM',
    model: 'onnx-community/whisper-tiny',
    backend: 'wasm',
    diagnosticOnly: true,
  },
]

const DEFAULT_PROFILES = new Set<SpeechLabProfileId>([
  'base-q4-webgpu',
  'base-q8-webgpu',
  'base-fp16-q8-webgpu',
])

function preferredMimeType(): string | undefined {
  if (typeof MediaRecorder === 'undefined') return undefined
  return [
    'audio/webm;codecs=opus',
    'audio/webm',
    'audio/ogg;codecs=opus',
    'audio/mp4',
  ].find((candidate) => MediaRecorder.isTypeSupported(candidate))
}

function formatMs(value: number): string {
  return value < 1_000
    ? `${Math.round(value)} ms`
    : `${(value / 1_000).toFixed(2).replace('.', ',')} s`
}

function formatPercent(value: number): string {
  return `${Math.round(value * 100)} %`
}

function profileOrder(ids: readonly SpeechLabProfileId[]): SpeechLabProfileId[] {
  const order = PROFILES.map((profile) => profile.id)
  return [...ids].sort((left, right) => order.indexOf(left) - order.indexOf(right))
}

export function SpeechLabView() {
  const [reference, setReference] = useState(DEFAULT_REFERENCE)
  const [recording, setRecording] = useState(false)
  const [running, setRunning] = useState(false)
  const [status, setStatus] = useState('')
  const [error, setError] = useState('')
  const [validation, setValidation] = useState<AudioValidation | null>(null)
  const [pcm, setPcm] = useState<Float32Array | null>(null)
  const [rawUrl, setRawUrl] = useState('')
  const [wavUrl, setWavUrl] = useState('')
  const [microphone, setMicrophone] = useState('noch nicht erfasst')
  const [selectedProfiles, setSelectedProfiles] = useState<Set<SpeechLabProfileId>>(DEFAULT_PROFILES)
  const [results, setResults] = useState<SpeechLabRunResult[]>([])
  const [baselineAbort, setBaselineAbort] = useState(false)

  const recorderRef = useRef<MediaRecorder | null>(null)
  const streamRef = useRef<MediaStream | null>(null)
  const chunksRef = useRef<Blob[]>([])
  const recordingStartedAtRef = useRef(0)
  const captureSampleRateRef = useRef<number | null>(null)
  const activeWorkerRef = useRef<Worker | null>(null)
  const cancelledRef = useRef(false)

  const selectedCount = selectedProfiles.size
  const referenceDurationValid = validation ? isReferenceDuration(validation.decodedDurationMs) : false

  const verdict = useMemo(() => {
    if (baselineAbort) return 'q4/q4 überschreitet 3 Sekunden: Browser-Ansatz auf dieser Hardware abbrechen.'
    if (results.length === 0) return ''
    const accepted = results.find((result) => result.latencyPass && result.qualityPass)
    if (accepted) return `${PROFILES.find((profile) => profile.id === accepted.profile)?.label}: erfüllt WER- und Latenzgrenze.`
    return 'Keine getestete Konfiguration erfüllt gleichzeitig WER ≤ 15 % und die definierte Latenzgrenze.'
  }, [baselineAbort, results])

  const revokeUrls = () => {
    if (rawUrl) URL.revokeObjectURL(rawUrl)
    if (wavUrl) URL.revokeObjectURL(wavUrl)
  }

  const resetAudio = () => {
    revokeUrls()
    setRawUrl('')
    setWavUrl('')
    setValidation(null)
    setPcm(null)
    setResults([])
    setBaselineAbort(false)
  }

  const stopStream = () => {
    streamRef.current?.getTracks().forEach((track) => track.stop())
    streamRef.current = null
  }

  const prepareBlob = async (
    blob: Blob,
    metadata: { chunkCount: number; wallDurationMs: number | null; captureSampleRate: number | null },
  ) => {
    resetAudio()
    setStatus('Blob wird dekodiert, validiert und auf 16 kHz PCM normalisiert.')
    const prepared = await decodeValidateAndPrepare(blob, metadata)
    setRawUrl(URL.createObjectURL(blob))
    setWavUrl(URL.createObjectURL(prepared.wav))
    setValidation(prepared.validation)
    setPcm(prepared.pcm)
    setStatus(prepared.validation.eligible
      ? 'Audio ist für den Modellvergleich geeignet.'
      : 'Audio ist nicht als belastbare Referenz geeignet. Hinweise prüfen und neu aufnehmen.')
  }

  const startRecording = async () => {
    if (recording || running) return
    setError('')
    setStatus('Mikrofon wird geöffnet.')
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: false,
        audio: {
          channelCount: 1,
          echoCancellation: true,
          noiseSuppression: true,
          autoGainControl: true,
        },
      })
      const track = stream.getAudioTracks()[0]
      const settings = track?.getSettings()
      captureSampleRateRef.current = typeof settings?.sampleRate === 'number' ? settings.sampleRate : null
      setMicrophone(track?.label || 'Browser-Standardmikrofon')

      const mimeType = preferredMimeType()
      const recorder = new MediaRecorder(stream, mimeType ? { mimeType } : undefined)
      chunksRef.current = []
      recorder.addEventListener('dataavailable', (event) => {
        if (event.data.size > 0) chunksRef.current.push(event.data)
      })
      recorder.addEventListener('error', () => {
        setError('MediaRecorder hat einen Aufnahmefehler gemeldet.')
        setRecording(false)
        stopStream()
      })

      streamRef.current = stream
      recorderRef.current = recorder
      recordingStartedAtRef.current = performance.now()
      recorder.start(250)
      setRecording(true)
      setStatus('Aufnahme läuft. Die Referenzfrage vollständig sprechen, dann stoppen.')
    } catch (recordingError) {
      stopStream()
      setError(recordingError instanceof Error ? recordingError.message : 'Mikrofon konnte nicht geöffnet werden.')
      setStatus('')
    }
  }

  const stopRecording = async () => {
    const recorder = recorderRef.current
    if (!recorder || recorder.state === 'inactive') return
    setRecording(false)
    setStatus('Aufnahme wird abgeschlossen.')
    const wallDurationMs = Math.round(performance.now() - recordingStartedAtRef.current)

    try {
      const blob = await new Promise<Blob>((resolve, reject) => {
        recorder.addEventListener('stop', () => {
          resolve(new Blob(chunksRef.current, { type: recorder.mimeType || 'audio/webm' }))
        }, { once: true })
        recorder.addEventListener('error', () => reject(new Error('Aufnahme konnte nicht abgeschlossen werden.')), { once: true })
        recorder.stop()
      })
      const chunkCount = chunksRef.current.length
      chunksRef.current = []
      recorderRef.current = null
      stopStream()
      await prepareBlob(blob, {
        chunkCount,
        wallDurationMs,
        captureSampleRate: captureSampleRateRef.current,
      })
    } catch (processingError) {
      stopStream()
      setError(processingError instanceof Error ? processingError.message : 'Audio konnte nicht vorbereitet werden.')
      setStatus('')
    }
  }

  const loadFile = async (file: File | null) => {
    if (!file || running || recording) return
    setError('')
    setMicrophone('Datei-Upload')
    try {
      await prepareBlob(file, {
        chunkCount: 1,
        wallDurationMs: null,
        captureSampleRate: null,
      })
    } catch (fileError) {
      setError(fileError instanceof Error ? fileError.message : 'Audiodatei konnte nicht verarbeitet werden.')
      setStatus('')
    }
  }

  const runProfile = (
    profile: SpeechLabProfileId,
    source: Float32Array,
    audioDurationMs: number,
  ): Promise<SpeechLabWorkerMessage> => new Promise((resolve) => {
    const worker = new Worker(new URL('../workers/speechLab.worker.ts', import.meta.url), { type: 'module' })
    activeWorkerRef.current = worker
    const id = globalThis.crypto?.randomUUID?.() ?? `${Date.now()}-${Math.random()}`

    worker.addEventListener('message', (event: MessageEvent<SpeechLabWorkerMessage>) => {
      const message = event.data
      if (message.id !== id) return
      if (message.type === 'progress') {
        const progress = message.progress === null ? '' : ` · ${Math.round(message.progress)} %`
        setStatus(`${PROFILES.find((item) => item.id === profile)?.label}: ${message.message}${progress}`)
        return
      }
      worker.terminate()
      if (activeWorkerRef.current === worker) activeWorkerRef.current = null
      resolve(message)
    })

    worker.addEventListener('error', (event) => {
      worker.terminate()
      if (activeWorkerRef.current === worker) activeWorkerRef.current = null
      resolve({ type: 'error', id, profile, message: event.message || 'Worker ist fehlgeschlagen.' })
    })

    const audio = source.slice()
    worker.postMessage({
      type: 'run',
      id,
      profile,
      audio,
      audioDurationMs,
    }, [audio.buffer])
  })

  const runSelectedProfiles = async () => {
    if (!pcm || !validation || !validation.eligible || running || selectedCount === 0) return
    setRunning(true)
    setError('')
    setResults([])
    setBaselineAbort(false)
    cancelledRef.current = false

    const nextResults: SpeechLabRunResult[] = []
    const profiles = profileOrder([...selectedProfiles])
    try {
      for (const profile of profiles) {
        if (cancelledRef.current) break
        const message = await runProfile(profile, pcm, validation.decodedDurationMs)
        if (cancelledRef.current) break
        if (message.type === 'error') {
          setError(`${PROFILES.find((item) => item.id === profile)?.label}: ${message.message}`)
          continue
        }
        if (message.type !== 'result') continue

        const warmWer = wordErrorRate(reference, message.warmTranscript)
        const result: SpeechLabRunResult = {
          ...message,
          firstWer: wordErrorRate(reference, message.firstTranscript),
          warmWer,
          warmRealtimeFactor: message.warmInferenceMs / message.audioDurationMs,
          latencyPass: latencyPass(message.warmInferenceMs, message.audioDurationMs),
          qualityPass: warmWer <= 0.15,
        }
        nextResults.push(result)
        setResults([...nextResults])

        if (
          profile === 'base-q4-webgpu'
          && shouldAbandonBrowserBaseline(
            message.warmInferenceMs,
            message.audioDurationMs,
            validation.eligible,
          )
        ) {
          setBaselineAbort(true)
          setStatus('Abbruchkriterium erreicht: q4/q4 braucht im warmen Lauf mehr als 3 Sekunden.')
          break
        }
      }
      if (!cancelledRef.current && !baselineAbort) setStatus('Modellvergleich abgeschlossen.')
    } finally {
      setRunning(false)
    }
  }

  const cancelRun = () => {
    cancelledRef.current = true
    activeWorkerRef.current?.terminate()
    activeWorkerRef.current = null
    setRunning(false)
    setStatus('Modellvergleich abgebrochen.')
  }

  const toggleProfile = (profile: SpeechLabProfileId) => {
    setSelectedProfiles((current) => {
      const next = new Set(current)
      if (next.has(profile)) next.delete(profile)
      else next.add(profile)
      return next
    })
  }

  useEffect(() => () => {
    activeWorkerRef.current?.terminate()
    if (recorderRef.current?.state === 'recording') recorderRef.current.stop()
    stopStream()
    if (rawUrl) URL.revokeObjectURL(rawUrl)
    if (wavUrl) URL.revokeObjectURL(wavUrl)
  }, [rawUrl, wavUrl])

  return (
    <section className="speech-lab" aria-label="Speech-Lab">
      <header className="speech-lab-header">
        <div>
          <span className="eyebrow">Diagnosebereich</span>
          <h1>Speech-Lab</h1>
        </div>
        <p>Kein produktiver Mikrofonpfad. Ziel ist eine reproduzierbare Entscheidung, nicht weiteres Blind-Tuning.</p>
      </header>

      <section className="speech-lab-card dictation-workaround">
        <h2>Sofort nutzbarer Workflow</h2>
        <p>Im Bereich „Erkennen“ das Textfeld fokussieren, <kbd>Win</kbd> + <kbd>H</kbd> drücken, Frage diktieren und Enter drücken.</p>
        <small>Die Windows-Diktierfunktion ist vom App-Code getrennt und unterliegt den Windows-Datenschutz- und Unternehmensrichtlinien.</small>
      </section>

      <section className="speech-lab-card">
        <h2>1. Referenz und identische Aufnahme</h2>
        <label htmlFor="speech-reference">Solltext für die WER-Berechnung</label>
        <textarea
          id="speech-reference"
          value={reference}
          rows={2}
          onChange={(event) => setReference(event.target.value)}
        />
        <div className="speech-lab-actions">
          <button type="button" onClick={recording ? stopRecording : startRecording} disabled={running}>
            {recording ? 'Aufnahme stoppen' : 'Referenz aufnehmen'}
          </button>
          <label className="file-button">
            Audiodatei laden
            <input type="file" accept="audio/*" onChange={(event) => void loadFile(event.target.files?.[0] ?? null)} />
          </label>
        </div>
        <p className="speech-lab-status" role="status">{error || status}</p>
      </section>

      {validation && (
        <section className="speech-lab-card">
          <h2>2. Blob- und PCM-Validierung</h2>
          <div className="audio-comparison">
            <label>Rohaufnahme<audio controls src={rawUrl} /></label>
            <label>Exakt getestetes 16-kHz-PCM<audio controls src={wavUrl} /></label>
          </div>
          <dl className="speech-lab-metrics">
            <div><dt>Mikrofon</dt><dd>{microphone}</dd></div>
            <div><dt>Blob</dt><dd>{validation.blobSize.toLocaleString('de-DE')} Bytes</dd></div>
            <div><dt>Chunks</dt><dd>{validation.chunkCount}</dd></div>
            <div><dt>MIME</dt><dd>{validation.mimeType}</dd></div>
            <div><dt>Reale Dauer</dt><dd>{validation.wallDurationMs === null ? 'Datei' : formatMs(validation.wallDurationMs)}</dd></div>
            <div><dt>Dekodierte Dauer</dt><dd>{formatMs(validation.decodedDurationMs)}</dd></div>
            <div><dt>Dauerverhältnis</dt><dd>{validation.durationRatio === null ? '–' : validation.durationRatio.toFixed(2).replace('.', ',')}</dd></div>
            <div><dt>Capture-Rate</dt><dd>{validation.captureSampleRate ? `${validation.captureSampleRate} Hz` : 'nicht gemeldet'}</dd></div>
            <div><dt>Decode-Rate</dt><dd>{validation.decodedSampleRate} Hz</dd></div>
            <div><dt>Kanäle</dt><dd>{validation.channels}</dd></div>
            <div><dt>PCM-Samples</dt><dd>{validation.pcmSamples.toLocaleString('de-DE')}</dd></div>
            <div><dt>Pegel</dt><dd>{validation.rmsDbfs} dBFS</dd></div>
            <div><dt>Nahe Null</dt><dd>{formatPercent(validation.nearZeroRatio)}</dd></div>
            <div><dt>Stille Anfang</dt><dd>{formatMs(validation.leadingSilenceMs)}</dd></div>
            <div><dt>Stille Ende</dt><dd>{formatMs(validation.trailingSilenceMs)}</dd></div>
            <div><dt>Referenz</dt><dd>{validation.eligible ? 'technisch geeignet' : 'ungeeignet'}</dd></div>
          </dl>
          {validation.warnings.map((warning) => <p className="speech-lab-warning" key={warning}>{warning}</p>)}
          {!referenceDurationValid && (
            <p className="speech-lab-warning">Für die harte Latenzentscheidung muss die Aufnahme 3 bis 12 Sekunden lang sein.</p>
          )}
        </section>
      )}

      <section className="speech-lab-card">
        <h2>3. Reproduzierbarer Modellvergleich</h2>
        <p>Jede Konfiguration erhält dasselbe PCM zweimal: erster Lauf inklusive Backend-Aufwärmung, danach der gemessene warme Lauf.</p>
        <div className="profile-grid">
          {PROFILES.map((profile) => (
            <label key={profile.id}>
              <input
                type="checkbox"
                checked={selectedProfiles.has(profile.id)}
                onChange={() => toggleProfile(profile.id)}
              />
              <span>{profile.label}</span>
            </label>
          ))}
        </div>
        <div className="speech-lab-actions">
          <button
            type="button"
            onClick={runSelectedProfiles}
            disabled={!validation?.eligible || !pcm || running || selectedCount === 0}
          >
            Ausgewählte Profile testen
          </button>
          {running && <button type="button" onClick={cancelRun}>Test abbrechen</button>}
        </div>
        <p className="acceptance-rule">Akzeptanz: warmer Lauf ≤ 1,5 s und RTF ≤ 0,5 bei 3–12 s Audio sowie WER ≤ 15 %. q4/q4 &gt; 3 s beendet den Browser-Test.</p>
      </section>

      {results.length > 0 && (
        <section className="speech-lab-card speech-results">
          <h2>4. Ergebnis</h2>
          <div className="speech-table-wrap">
            <table>
              <thead>
                <tr>
                  <th>Profil</th>
                  <th>Laden</th>
                  <th>1. Lauf</th>
                  <th>Warm</th>
                  <th>RTF</th>
                  <th>WER</th>
                  <th>Transkript warm</th>
                  <th>Urteil</th>
                </tr>
              </thead>
              <tbody>
                {results.map((result) => (
                  <tr key={result.profile}>
                    <td>{PROFILES.find((profile) => profile.id === result.profile)?.label}</td>
                    <td>{formatMs(result.modelLoadMs)}</td>
                    <td>{formatMs(result.firstInferenceMs)}</td>
                    <td>{formatMs(result.warmInferenceMs)}</td>
                    <td>{result.warmRealtimeFactor.toFixed(2).replace('.', ',')}</td>
                    <td>{formatPercent(result.warmWer)}</td>
                    <td>{result.warmTranscript || 'kein Text'}</td>
                    <td>{result.latencyPass && result.qualityPass ? 'bestanden' : 'nicht bestanden'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          {verdict && <p className={baselineAbort ? 'speech-lab-stop' : 'speech-lab-verdict'}>{verdict}</p>}
        </section>
      )}
    </section>
  )
}
