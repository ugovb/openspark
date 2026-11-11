import type { AppCommand } from '../../../shared/commands'
export { menuHandlesKey } from '../../../shared/commands'
import { api } from './api'
import { openSettings, useStore } from './store'

/** Search view, or focus its field when already there. */
export function openSearch(): void {
  const st = useStore.getState()
  if (st.view === 'search') document.getElementById('openmail-search')?.focus()
  else st.setView('search')
}

/**
 * Run an app command: the single implementation behind keyboard shortcuts, the command palette and the macOS menu bar.
 * Message commands with nothing selected do nothing (silently).
 */
export function runCommand(c: AppCommand): void {
  const st = useStore.getState()
  const sel = st.threads.find((x) => x.thread_id === st.selected)
  const MESSAGE: AppCommand[] = ['reply', 'replyall', 'forward', 'archive', 'trash', 'snooze', 'pin', 'toggleRead']
  // same gate as the keyboard handler: only in the mail view, with no picker, palette or composer window open
  if (MESSAGE.includes(c) && (st.view !== 'mail' || st.palette || st.snoozeFor || st.moveFor || st.labelFor || (st.composer && !st.composer.inline))) return
  const compose = (mode: 'reply' | 'replyall' | 'forward') => {
    if (sel) st.compose({ mode, messageId: sel.latest_message_id, threadId: sel.thread_id })
  }
  switch (c) {
    case 'compose': st.compose({ mode: 'new' }); return
    // a conversation window only renders its thread in the mail view: opening Settings there would blank it
    case 'settings': if (!st.standalone) openSettings('general'); return
    // a conversation window only renders its thread in the mail view: searching there would blank it (as the old Ctrl+F guard did)
    case 'search': if (!st.standalone) openSearch(); return
    case 'palette': useStore.setState({ palette: !st.palette }); return
    case 'sync': void api.syncNow().catch(() => undefined); return
    case 'reply': case 'replyall': case 'forward': compose(c); return
    case 'archive': if (st.targets().length) void st.act('archive'); return
    case 'trash': if (st.targets().length) void st.act('trash'); return
    case 'snooze': if (st.targets().length) useStore.setState({ snoozeFor: st.targets(), pickerMode: 'snooze' }); return
    case 'pin': if (sel) void st.act(sel.pinned ? 'unpin' : 'pin'); return
    case 'toggleRead': if (sel) void st.act(sel.unread ? 'read' : 'unread'); return
  }
}
