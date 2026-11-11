import type { MenuItemConstructorOptions } from 'electron'
import { t } from '../shared/i18n'
import type { AppCommand } from '../shared/commands'

/**
 * The macOS menu bar. Only CmdOrCtrl+N/,/F/K are real accelerators here (macOS key equivalents; the renderer skips them
 * on darwin, see menuHandlesKey). Plain-letter shortcuts (R, A, F, E, H, S, U, Delete) stay renderer-only so typing is never swallowed.
 * Call it again after a language change: labels are translated when the template is built.
 */
export function appMenuTemplate(appName: string, send: (c: AppCommand) => void): MenuItemConstructorOptions[] {
  const item = (label: string, accelerator: string | undefined, command: AppCommand): MenuItemConstructorOptions => ({
    label, ...(accelerator ? { accelerator } : {}), click: () => send(command),
  })
  return [
    {
      label: appName,
      submenu: [
        { role: 'about' },
        { type: 'separator' },
        item(t('Settings…'), 'CmdOrCtrl+,', 'settings'),
        { type: 'separator' },
        { role: 'services' },
        { type: 'separator' },
        { role: 'hide' },
        { role: 'hideOthers' },
        { role: 'unhide' },
        { type: 'separator' },
        { role: 'quit' },
      ],
    },
    { label: t('File'), submenu: [item(t('New message'), 'CmdOrCtrl+N', 'compose'), { type: 'separator' }, { role: 'close' }] },
    { role: 'editMenu' },
    {
      label: t('Message'),
      submenu: [
        item(t('Reply'), undefined, 'reply'),
        item(t('Reply all'), undefined, 'replyall'),
        item(t('Forward'), undefined, 'forward'),
        { type: 'separator' },
        item(t('Archive'), undefined, 'archive'),
        item(t('Move to Trash'), undefined, 'trash'),
        { type: 'separator' },
        item(t('Snooze'), undefined, 'snooze'),
        item(t('Pin'), undefined, 'pin'),
        item(t('Mark as read or unread'), undefined, 'toggleRead'),
      ],
    },
    {
      label: t('View'),
      submenu: [
        item(t('Search'), 'CmdOrCtrl+F', 'search'),
        item(t('Command palette'), 'CmdOrCtrl+K', 'palette'),
        item(t('Sync now'), undefined, 'sync'),
        { type: 'separator' },
        { role: 'reload' },
        { role: 'togglefullscreen' },
        { role: 'resetZoom' },
        { role: 'zoomIn' },
        { role: 'zoomOut' },
      ],
    },
    { role: 'windowMenu' },
  ]
}
