import { Component, type ErrorInfo, type ReactNode } from 'react'
import { t } from '../../../shared/i18n'

/** Shows the error instead of a blank window, so a crash in one view can be reported. */
export default class ErrorBoundary extends Component<{ children: ReactNode }, { error: Error | null }> {
  state = { error: null as Error | null }

  static getDerivedStateFromError(error: Error) {
    return { error }
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    console.error('UI crash:', error, info.componentStack)
  }

  render() {
    const { error } = this.state
    if (!error) return this.props.children
    return (
      <div className="flex h-full flex-col items-center justify-center gap-3 bg-bg p-6 text-center text-fg">
        <div className="text-[16px] font-semibold">{t('Something went wrong')}</div>
        <pre className="selectable max-h-60 max-w-[640px] overflow-auto whitespace-pre-wrap rounded-xl border border-line bg-surface p-3 text-left text-[12px] text-muted">{error.stack || error.message}</pre>
        <button onClick={() => location.reload()} className="rounded-lg bg-accent px-4 py-2 text-[13px] font-medium text-accent-fg">{t('Reload')}</button>
      </div>
    )
  }
}
