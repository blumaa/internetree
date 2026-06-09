import { Component, type ReactNode } from 'react'

interface Props {
  children: ReactNode
}
interface State {
  failed: boolean
}

/** Last-resort guard so a render-time throw shows a gentle fallback, not a blank page. */
export class ErrorBoundary extends Component<Props, State> {
  state: State = { failed: false }

  static getDerivedStateFromError(): State {
    return { failed: true }
  }

  componentDidCatch(error: unknown) {
    console.error('Internetree crashed:', error)
  }

  render() {
    if (this.state.failed) {
      return (
        <div className="crash">
          <p>the tree slipped out of view.</p>
          <button type="button" onClick={() => window.location.reload()}>
            reload
          </button>
        </div>
      )
    }
    return this.props.children
  }
}
