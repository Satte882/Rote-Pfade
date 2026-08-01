import { useState } from 'react'
import { AnalyzeView } from './components/AnalyzeView'
import { DataControls } from './components/DataControls'
import { LibraryView } from './components/LibraryView'
import { TrainingView } from './components/TrainingView'

type Tab = 'analyse' | 'training' | 'library'

const TABS: { id: Tab; label: string; description: string }[] = [
  { id: 'analyse', label: 'Erkennen', description: 'Frage zuordnen' },
  { id: 'training', label: 'Training', description: 'Fäden üben' },
  { id: 'library', label: 'Fäden', description: 'Nachschlagen' },
]

export default function App() {
  const [activeTab, setActiveTab] = useState<Tab>('analyse')
  const [dataVersion, setDataVersion] = useState(0)
  const notifyDataChanged = () => setDataVersion((value) => value + 1)

  return (
    <div className="app-shell">
      <header className="topbar">
        <div className="brand-block">
          <div className="brand-mark" aria-hidden="true">RP</div>
          <div>
            <strong>Rote Pfade</strong>
            <span>Interviewfragen strukturiert beantworten</span>
          </div>
        </div>

        <nav className="main-tabs" aria-label="Hauptnavigation">
          {TABS.map((tab) => (
            <button
              className={activeTab === tab.id ? 'tab active' : 'tab'}
              type="button"
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              aria-current={activeTab === tab.id ? 'page' : undefined}
            >
              <strong>{tab.label}</strong>
              <span>{tab.description}</span>
            </button>
          ))}
        </nav>

        <DataControls key={dataVersion} onDataChanged={notifyDataChanged} />
      </header>

      <main>
        {activeTab === 'analyse' && <AnalyzeView onFeedbackSaved={notifyDataChanged} />}
        {activeTab === 'training' && <TrainingView dataVersion={dataVersion} />}
        {activeTab === 'library' && <LibraryView />}
      </main>

      <footer>
        <span>Vollständig clientseitig · kein externes LLM · keine Übertragung der Eingaben</span>
        <span>13 konsolidierte Fäden · Version 1.0</span>
      </footer>
    </div>
  )
}
