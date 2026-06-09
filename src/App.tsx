import { useState } from 'react'
import { useInternetree, type Delta } from './sim/useInternetree'
import { Timeline } from './render/Timeline'
import { Motes } from './render/Motes'
import { share } from './share'
import { stageFor, moodFor } from './engine/tree'
import './App.css'

const DAY = 86_400_000

function shareInvite(generation: number, keepers: number) {
  share(
    keepers > 0
      ? `Internetree — generation ${generation}, kept alive by ${keepers.toLocaleString()} people. help keep it alive.`
      : "help keep the internet's tree alive",
  )
}

function deltaText(d: Delta): string {
  if (d.newGeneration) return 'a tree fell while you were away — a new one is rising'
  const parts: string[] = []
  if (d.tended > 0) parts.push(`${d.tended.toLocaleString()} tended it`)
  if (d.grew) parts.push('it grew')
  if (parts.length === 0) parts.push(d.healthDelta < 0 ? "it's been quiet" : 'all calm')
  return `while you were away · ${parts.join(' · ')}`
}

function App() {
  const {
    tree,
    history,
    keepers,
    recentTends,
    syncing,
    error,
    sync,
    tend,
    canTend,
    tokens,
    maxTokens,
    lastDelta,
    dismissDelta,
    dev,
  } = useInternetree()
  const [showDev, setShowDev] = useState(false)

  return (
    <div className="scene">
      <header className="brand">
        <h1>Internetree</h1>
        <p className="ambient">
          {keepers > 0
            ? `kept alive by ${keepers.toLocaleString()} ${keepers === 1 ? 'person' : 'people'}`
            : 'one tree. keep it alive together.'}
        </p>
      </header>

      {error ? (
        <div className="banner banner--error" role="alert">
          {error}.{' '}
          <button type="button" className="banner-retry" onClick={sync}>
            retry
          </button>
        </div>
      ) : (
        lastDelta && (
          <button type="button" className="delta" onClick={dismissDelta}>
            {deltaText(lastDelta)}
          </button>
        )
      )}

      <main className="stage">
        <Motes count={recentTends.length} />
        <Timeline tree={tree} history={history} canTend={canTend} onTend={tend} />
      </main>

      <footer className="actions">
        <p className="hint">
          {canTend ? 'tap the tree to tend it' : 'your watering can is empty — refills soon'}
        </p>
        <div className="can" aria-label={`${tokens} of ${maxTokens} tends left in your watering can`}>
          {Array.from({ length: maxTokens }).map((_, i) => (
            <span key={i} className={i < tokens ? 'drop drop--full' : 'drop'} />
          ))}
        </div>
        <div className="footer-links">
          <button type="button" className="link-btn" onClick={sync} disabled={syncing}>
            {syncing ? 'syncing…' : '↻ sync'}
          </button>
          <button
            type="button"
            className="link-btn"
            onClick={() => shareInvite(tree.generation, keepers)}
          >
            ↗ invite a friend
          </button>
        </div>
      </footer>

      {/* Dev harness — DEV builds only; tree-shaken out of production. */}
      {import.meta.env.DEV && (
        <>
          <button
            type="button"
            className="dev-toggle"
            onClick={() => setShowDev((v) => !v)}
            aria-label="toggle dev harness"
          >
            {showDev ? '×' : 'dev'}
          </button>

          {showDev && (
            <section className="harness" aria-label="dev harness">
              <div className="harness-row">
                <span className="harness-label">time</span>
                <div className="harness-speeds">
                  <button type="button" onClick={() => dev.advance(DAY)}>+1d</button>
                  <button type="button" onClick={() => dev.advance(3 * DAY)}>+3d</button>
                  <button type="button" onClick={() => dev.advance(7 * DAY)}>+7d</button>
                </div>
              </div>
              <div className="harness-row">
                <span className="harness-label">crowd</span>
                <div className="harness-speeds">
                  <button type="button" onClick={() => dev.simulateStrangers(10)}>+10 tend</button>
                  <button type="button" onClick={() => dev.simulateStrangers(50)}>+50 tend</button>
                </div>
              </div>
              <dl className="stats">
                <div><dt>gen</dt><dd>{tree.generation}</dd></div>
                <div><dt>stage</dt><dd>{stageFor(tree.growth)}</dd></div>
                <div><dt>status</dt><dd className={`s-${tree.status}`}>{tree.status}</dd></div>
                <div><dt>mood</dt><dd>{moodFor(tree.health)}</dd></div>
                <div><dt>health</dt><dd>{tree.health.toFixed(0)}</dd></div>
                <div><dt>growth</dt><dd>{tree.growth}</dd></div>
                <div><dt>tends</dt><dd>{tree.tendCount}</dd></div>
              </dl>
            </section>
          )}
        </>
      )}
    </div>
  )
}

export default App
