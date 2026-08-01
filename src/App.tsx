import { useRef, useState } from 'react'
import { AnalyzeView } from './components/AnalyzeView'
import { DataControls } from './components/DataControls'
import { LibraryView } from './components/LibraryView'
import { TrainingView } from './components/TrainingView'

type Tab = 'analyse' | 'training' | 'library'
type Layout = 'vertical' | 'horizontal'

const TABS: { id: Tab; label: string }[] = [
  { id: 'analyse', label: 'Erkennen' },
  { id: 'training', label: 'Training' },
  { id: 'library', label: 'Fäden' },
]

const LAYOUT_KEY = 'rote-pfade.layout.v1'

function getInitialLayout(): Layout {
  return localStorage.getItem(LAYOUT_KEY) === 'horizontal' ? 'horizontal' : 'vertical'
}

export default function App() {
  const [activeTab, setActiveTab] = useState<Tab>('analyse')
  const [layout, setLayoutState] = useState<Layout>(getInitialLayout)
  const [dataVersion, setDataVersion] = useState(0)
  const menuRef = useRef<HTMLDetailsElement>(null)
  const notifyDataChanged = () => setDataVersion((value) => value + 1)

  const selectTab = (tab: Tab) => {
    setActiveTab(tab)
    menuRef.current?.removeAttribute('open')
  }

  const setLayout = (nextLayout: Layout) => {
    setLayoutState(nextLayout)
    localStorage.setItem(LAYOUT_KEY, nextLayout)
    menuRef.current?.removeAttribute('open')
  }

  return (
    <div className={`app-shell layout-${layout}`}>
      <header className="compact-header">
        <button className="brand-button" type="button" onClick={() => selectTab('analyse')}>
          <span aria-hidden="true">RP</span>
          <strong>Rote Pfade</strong>
        </button>

        <details className="app-menu" ref={menuRef}>
          <summary aria-label="Menü öffnen">•••</summary>
          <div className="menu-panel">
            <div className="layout-options" aria-label="Darstellung wählen">
              <span>Darstellung</span>
              <div>
                <button
                  className={layout === 'vertical' ? 'layout-button active' : 'layout-button'}
                  type="button"
                  onClick={() => setLayout('vertical')}
                >
                  Vertikal
                </button>
                <button
                  className={layout === 'horizontal' ? 'layout-button active' : 'layout-button'}
                  type="button"
                  onClick={() => setLayout('horizontal')}
                >
                  Horizontal
                </button>
              </div>
            </div>

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
