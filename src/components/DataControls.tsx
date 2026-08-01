import { useRef, useState } from 'react'
import { clearLocalData, downloadExport, importExport, loadFeedback } from '../lib/storage'

type DataControlsProps = {
  onDataChanged: () => void
}

export function DataControls({ onDataChanged }: DataControlsProps) {
  const inputRef = useRef<HTMLInputElement>(null)
  const [status, setStatus] = useState('')
  const feedbackCount = loadFeedback().length

  const handleImport = async (file?: File) => {
    if (!file) return
    try {
      const payload = await importExport(file)
      setStatus(`${payload.feedback.length} Zuordnungen importiert.`)
      onDataChanged()
    } catch (error) {
      setStatus(error instanceof Error ? error.message : 'Import fehlgeschlagen.')
    } finally {
      if (inputRef.current) inputRef.current.value = ''
    }
  }

  const handleClear = () => {
    const confirmed = window.confirm('Lokale Zuordnungen und Trainingsstatistik wirklich löschen?')
    if (!confirmed) return
    clearLocalData()
    setStatus('Lokale Daten wurden gelöscht.')
    onDataChanged()
  }

  return (
    <div className="data-controls">
      <span className="local-badge">{feedbackCount} lokale Zuordnungen</span>
      <button className="button button-quiet" type="button" onClick={downloadExport}>
        Export
      </button>
      <button className="button button-quiet" type="button" onClick={() => inputRef.current?.click()}>
        Import
      </button>
      <button className="button button-danger" type="button" onClick={handleClear}>
        Löschen
      </button>
      <input
        ref={inputRef}
        className="visually-hidden"
        type="file"
        accept="application/json,.json"
        onChange={(event) => void handleImport(event.target.files?.[0])}
      />
      <span className="data-status" aria-live="polite">{status}</span>
    </div>
  )
}
