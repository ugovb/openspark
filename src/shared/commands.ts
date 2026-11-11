/** Commands the macOS menu bar (main process) can ask the renderer to run. */
export const APP_COMMANDS = ['compose', 'settings', 'search', 'palette', 'sync', 'reply', 'replyall', 'forward', 'archive', 'trash', 'snooze', 'pin', 'toggleRead'] as const

export type AppCommand = (typeof APP_COMMANDS)[number]

export function isAppCommand(x: unknown): x is AppCommand {
  return typeof x === 'string' && (APP_COMMANDS as readonly string[]).includes(x)
}

/** True when the macOS menu bar already fires this key combination (so the keyboard handler must not run it twice). */
export function menuHandlesKey(platform: string, e: { key: string; ctrlKey: boolean; metaKey: boolean; altKey: boolean; shiftKey?: boolean }): boolean {
  // the menu accelerators are exact (CmdOrCtrl+N/F/K/,): a Shift combo is not fired by the menu, so the renderer keeps it
  return platform === 'darwin' && !e.shiftKey && e.metaKey && !e.ctrlKey && !e.altKey && ['n', 'f', 'k', ','].includes(e.key.toLowerCase())
}
