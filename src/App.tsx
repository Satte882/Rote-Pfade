import { useRef, useState } from 'react'
import { AnalyzeView } from './components/AnalyzeView'
import { DataControls } from './components/DataControls'
import { LibraryView } from './components/LibraryView'
import { TrainingView } from './components/TrainingView'

type Tab = 'analyse' | 'training' | 'library'

const TABS: { id: Tab; label: string }[] = [
  { id: 'analyse', label: 'Erkennen' },
  { id: 'training', label: 'Training' },
  { id: 'library', label: 'Fäden' },
]

export default function App() {
  const [activeTab, setActiveTab] = useState<Tab>('analyse')
  const [dataVersion, setDataVersion] = useState(0)
  const menuRef = useRef<HTMLDetailsElement>(null)
  const notifyDataChanged = () => setDataVersion((value) => value + 1)

  const selectTab = (tab: Tab) => {
    setActiveTab(tab)
    menuRef.current?.removeAttribute('open')
  }

  return (
    <div className="app-shell">
      <header className="compact-header">
        <button className="brand-button" type="button" onClick={() => selectTab('analyse')}>
          <span aria-hidden="true">RP</span>
          <strong>Rote Pfade</strong>
        </button>

        <details className="app-menu" ref={menuRef}>
          <summary aria-label="Menü öffnen">•••</summary>
          <div className="menu-panel">
            <nav aria-label="Bereiche">
              {TABS.map((tab) => (
                <button
                  className={activeTab === tab.id ? 'menu-link active' : 'menu-link'}
                  type="button"
                  key={tab.id}
                  onClick={() => selectTab(tab.id)}
                >
                  {tab.label}
                </button>
              ))}
            </nav>
            <DataControls key={dataVersion} onDataChanged={notifyDataChanged} />
          </div>
        </details>
      </header>

      <main>
        {activeTab === 'analyse' && <AnalyzeView onFeedbackSaved={notifyDataChanged} />}
        {activeTab === 'training' && <TrainingView dataVersion={dataVersion} />}
        {activeTab === 'library' && <LibraryView />}
      </main>
    </div>
  )
}
