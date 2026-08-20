import { useMemo, useState } from 'react'
import { threads } from '../lib/classifier'

export function LibraryView() {
  const [query, setQuery] = useState('')
  const [category, setCategory] = useState('Alle')
  const [expandedId, setExpandedId] = useState<string | null>(null)

  const categories = useMemo(
    () => ['Alle', ...Array.from(new Set(threads.map((thread) => thread.category)))],
    [],
  )

  const filteredThreads = useMemo(() => {
    const normalizedQuery = query.trim().toLocaleLowerCase('de-DE')
    return threads.filter((thread) => {
      const matchesCategory = category === 'Alle' || thread.category === category
      const variantText = thread.variants?.flatMap((variant) => [
        variant.name,
        variant.description,
        ...variant.steps,
        ...variant.examples,
      ]) ?? []
      const haystack = [
        thread.name,
        thread.category,
        thread.description,
        thread.purpose,
        thread.mnemonic,
        ...thread.steps,
        ...thread.examples,
        ...variantText,
      ].join(' ').toLocaleLowerCase('de-DE')
      return matchesCategory && (!normalizedQuery || haystack.includes(normalizedQuery))
    })
  }, [category, query])

  return (
    <section className="view library-view" aria-labelledby="library-title">
      <div className="section-heading split-heading">
        <div>
          <p className="eyebrow">Nachschlagewerk</p>
          <h1 id="library-title">Die {threads.length} roten Fäden</h1>
          <p>Fäden und fachliche Varianten sind lesbar und durchsuchbar; Änderungen erfolgen kontrolliert im Repository.</p>
        </div>
        <div className="thread-count"><strong>{filteredThreads.length}</strong><span>angezeigt</span></div>
      </div>

      <div className="library-tools">
        <label htmlFor="library-search">
          <span>Fäden durchsuchen</span>
          <input
            id="library-search"
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="Name, Variante, Beispiel oder Merksatz"
          />
        </label>
        <div className="category-filters" aria-label="Kategorien">
          {categories.map((item) => (
            <button
              className={item === category ? 'filter-chip active' : 'filter-chip'}
              type="button"
              key={item}
              onClick={() => setCategory(item)}
            >
              {item}
            </button>
          ))}
        </div>
      </div>

      <div className="library-grid">
        {filteredThreads.map((thread, index) => {
          const expanded = expandedId === thread.id
          return (
            <article className={expanded ? 'thread-card expanded' : 'thread-card'} key={thread.id}>
              <button className="thread-card-header" type="button" onClick={() => setExpandedId(expanded ? null : thread.id)}>
                <span className="thread-index">{String(index + 1).padStart(2, '0')}</span>
                <span className="thread-heading">
                  <small>{thread.category}</small>
                  <strong>{thread.name}</strong>
                  <span>{thread.mnemonic}</span>
                </span>
                <span className="expand-symbol" aria-hidden="true">{expanded ? '−' : '+'}</span>
              </button>

              {expanded && (
                <div className="thread-card-body">
                  <div className="thread-purpose">
                    <span>Ziel</span>
                    <strong>{thread.purpose}</strong>
                  </div>
                  <ol>
                    {thread.steps.map((step) => <li key={step}>{step}</li>)}
                  </ol>
                  {thread.variants && thread.variants.length > 0 && (
                    <div className="variant-list">
                      <span>Fachliche Varianten</span>
                      {thread.variants.map((variant) => (
                        <section key={variant.id}>
                          <strong>{variant.name}</strong>
                          <ol>
                            {variant.steps.map((step) => <li key={step}>{step}</li>)}
                          </ol>
                        </section>
                      ))}
                    </div>
                  )}
                  <div className="example-list">
                    <span>Anonymisierte Beispiele</span>
                    {thread.examples.map((example) => <p key={example}>„{example}“</p>)}
                  </div>
                </div>
              )}
            </article>
          )
        })}
      </div>

      {filteredThreads.length === 0 && <div className="empty-state">Keine passenden Fäden gefunden.</div>}
    </section>
  )
}
