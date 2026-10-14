import Placeholder from '@tiptap/extension-placeholder'
import { EditorContent, useEditor, type Editor } from '@tiptap/react'
import StarterKit from '@tiptap/starter-kit'
import {
  Bell, Bold, Check, ChevronDown, ChevronsUpDown, Clock, EyeOff, FileText, Handshake, Italic, Link2, List, ListOrdered, Loader2, Maximize2, Minimize2, Paperclip, Quote,
  RemoveFormatting, Send, Settings, Sparkles, Strikethrough, Trash2, Underline as UnderlineIcon, Wand2, X,
} from 'lucide-react'
import { useCallback, useEffect, useRef, useState } from 'react'
import type { Address, Contact, DraftAttachment, DraftView, Signature, Template } from '../../../shared/types'
import { availablePresets, formatWhen, parseWhen, presetLabel, presetTime } from '../../../shared/when'
import { api, errorText, stream } from '../lib/api'
import { displayName, fileSize, mdToHtml, stripSignatureHtml } from '../lib/format'
import { isNarrow, useNarrow } from '../lib/narrow'
import { type ComposerRequest, openSettings, useStore } from '../lib/store'
import { askText, Avatar, cx, IconButton, Menu, type MenuItem, Popover, Spinner, Tip, TipButton } from './ui'
import { t } from '../../../shared/i18n'

function addrLabel(a: Address) {
  return a.name ? `${a.name} <${a.email}>` : a.email
}

function parseOne(s: string): Address | null {
  const v = s.trim().replace(/[,;]$/, '')
  if (!v) return null
  const m = v.match(/^\s*"?([^"<]*?)"?\s*<([^>]+)>\s*$/)
  if (m) return { name: m[1].trim() || undefined, email: m[2].trim().toLowerCase() }
  if (/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(v)) return { email: v.toLowerCase() }
  return null
}

function RecipientInput({ label, value, onChange, autoFocus }: { label: string; value: Address[]; onChange: (v: Address[]) => void; autoFocus?: boolean }) {
  const [text, setText] = useState('')
  const [sugg, setSugg] = useState<Contact[]>([])
  const [hi, setHi] = useState(0)
  useEffect(() => {
    if (text.trim().length < 1) {
      setSugg([])
      return
    }
    const h = setTimeout(() => void api.suggestContacts(text.trim()).then((r) => (setSugg(r.filter((c) => !value.some((v) => v.email === c.email))), setHi(0))), 80)
    return () => clearTimeout(h)
  }, [text])
  const commit = (raw = text) => {
    const parts = raw.split(/[,;\n]/).map(parseOne).filter((x): x is Address => !!x)
    if (parts.length) {
      onChange([...value, ...parts.filter((p) => !value.some((v) => v.email === p.email))])
      setText('')
      setSugg([])
      return true
    }
    return false
  }
  const pick = (c: Contact) => {
    onChange([...value, { name: c.name || undefined, email: c.email }])
    setText('')
    setSugg([])
  }
  return (
    <div className="relative flex min-h-10 flex-wrap items-center gap-1 border-b border-line px-4 py-1">
      <span className="w-12 shrink-0 text-[12.5px] text-muted">{label}</span>
      {value.map((a) => (
        <span key={a.email} title={a.email} className="inline-flex items-center gap-1 rounded-md bg-accent-soft px-1.5 py-0.5 text-[12.5px] text-accent">
          {displayName(a)}
          <button onClick={() => onChange(value.filter((v) => v.email !== a.email))}><X size={11} /></button>
        </span>
      ))}
      <input
        autoFocus={autoFocus}
        value={text}
        onChange={(e) => {
          const v = e.target.value
          if (/[,;]$/.test(v) && commit(v)) return
          setText(v)
        }}
        onPaste={(e) => {
          const pasted = e.clipboardData.getData('text')
          if (/[,;\n]/.test(pasted)) {
            e.preventDefault()
            commit(pasted)
          }
        }}
        onKeyDown={(e) => {
          if (sugg.length && (e.key === 'ArrowDown' || e.key === 'ArrowUp')) {
            e.preventDefault()
            setHi((h) => (h + (e.key === 'ArrowDown' ? 1 : -1) + sugg.length) % sugg.length)
          } else if ((e.key === 'Enter' || e.key === 'Tab') && sugg.length) {
            e.preventDefault()
            pick(sugg[hi])
          } else if ((e.key === 'Enter' || e.key === 'Tab') && text.trim()) {
            if (commit()) e.preventDefault()
          } else if (e.key === 'Backspace' && !text && value.length) onChange(value.slice(0, -1))
        }}
        onBlur={() => setTimeout(() => (commit(), setSugg([])), 150)}
        className="h-7 min-w-[140px] flex-1 bg-transparent text-[13.5px] outline-none no-focus-ring"
      />
      {sugg.length > 0 && (
        <div className="absolute left-14 top-full z-30 mt-1 w-[360px] max-w-[calc(100vw-80px)] overflow-hidden rounded-xl border border-line bg-surface py-1" style={{ boxShadow: 'var(--shadow)' }}>
          {sugg.map((c, i) => (
            <button key={c.email} onMouseDown={(e) => (e.preventDefault(), pick(c))} className={cx('flex w-full flex-col px-3 py-1.5 text-left', i === hi ? 'bg-accent-soft' : 'hover:bg-hover')}>
              <span className="text-[13px]">{c.name || c.email}</span>
              {c.name && <span className="text-[11.5px] text-muted">{c.email}</span>}
            </button>
          ))}
        </div>
      )}
    </div>
  )
}

function Toolbar({ editor }: { editor: Editor | null }) {
  if (!editor) return null
  const b = (active: boolean, onClick: () => void, icon: React.ReactNode, title: string) => (
    <IconButton size="sm" active={active} title={title} onMouseDown={(e) => e.preventDefault()} onClick={onClick}>{icon}</IconButton>
  )
  return (
    <div className="flex items-center gap-0.5">
      {b(editor.isActive('bold'), () => editor.chain().focus().toggleBold().run(), <Bold size={14} />, t('Bold (Ctrl+B)'))}
      {b(editor.isActive('italic'), () => editor.chain().focus().toggleItalic().run(), <Italic size={14} />, t('Italic (Ctrl+I)'))}
      {b(editor.isActive('underline'), () => editor.chain().focus().toggleUnderline().run(), <UnderlineIcon size={14} />, t('Underline (Ctrl+U)'))}
      {b(editor.isActive('strike'), () => editor.chain().focus().toggleStrike().run(), <Strikethrough size={14} />, t('Strikethrough'))}
      {b(editor.isActive('bulletList'), () => editor.chain().focus().toggleBulletList().run(), <List size={14} />, t('Bulleted list'))}
      {b(editor.isActive('orderedList'), () => editor.chain().focus().toggleOrderedList().run(), <ListOrdered size={14} />, t('Numbered list'))}
      {b(editor.isActive('blockquote'), () => editor.chain().focus().toggleBlockquote().run(), <Quote size={14} />, t('Quote'))}
      {b(editor.isActive('link'), async () => {
        if (editor.isActive('link')) {
          editor.chain().focus().unsetLink().run()
          return
        }
        const url = await askText(t('Link address'), 'https://')
        if (url) editor.chain().focus().extendMarkRange('link').setLink({ href: url }).run()
      }, <Link2 size={14} />, t('Link'))}
      {b(false, () => editor.chain().focus().unsetAllMarks().clearNodes().run(), <RemoveFormatting size={14} />, t('Clear formatting'))}
    </div>
  )
}

function WhenMenu({ kind, anchor, onPick, onClose }: { kind: 'send' | 'remind'; anchor: { x: number; y: number } | null; onPick: (ts: number) => void; onClose: () => void }) {
  const settings = useStore((s) => s.settings)
  const cfg = { morningHour: settings?.snoozeMorningHour ?? 8, eveningHour: settings?.snoozeEveningHour ?? 18 }
  const presets = availablePresets(kind === 'send' ? 'send' : 'remind', new Date(), cfg)
  const items: MenuItem[] = [
    ...presets.map((p) => ({ label: presetLabel(p), hint: formatWhen(presetTime(p, new Date(), cfg)), onClick: () => onPick(presetTime(p, new Date(), cfg)) })),
    { separator: true, label: '' },
    {
      label: t('Pick a date…'), onClick: async () => {
        const v = await askText(kind === 'send' ? t('When to send?') : t('When to remind you?'), '', t('e.g. tomorrow 9:00, fri 14:30, 20.10 8:15, in 3 days'))
        if (!v) return
        const ts = parseWhen(v, new Date(), cfg)
        if (ts) onPick(ts)
        else useStore.getState().toast({ level: 'error', message: t('I don’t understand the date “{date}”', { date: v }) })
      },
    },
  ]
  return <Menu items={items} anchor={anchor} onClose={onClose} />
}

interface Identity {
  id: number
  account_id: number
  email: string
  name: string
  signature_id: number | null
  is_default: number
}

/** "From" picker: the current address with the name under it, a dropdown of all sending addresses. */
function IdentityMenu({ identities, value, onChange, above }: { identities: Identity[]; value: string; onChange: (email: string) => void; above?: boolean }) {
  const [anchor, setAnchor] = useState<DOMRect | null>(null)
  const cur = identities.find((i) => i.email === value)
  return (
    <>
      <Tip label={t('Send from')}>
        <button
          aria-label={t('Send from')}
          onMouseDown={(e) => e.nativeEvent.stopPropagation()}
          onClick={(e) => setAnchor(anchor ? null : e.currentTarget.getBoundingClientRect())}
          className={cx('flex h-8 min-w-0 max-w-[230px] items-center gap-1 rounded-lg px-1.5 text-left hover:bg-hover', anchor && 'bg-hover')}
        >
          {/* a phone has room for the avatar only */}
          <Avatar addr={{ email: cur?.email || value || '?', name: cur?.name }} size={24} className="md:hidden" />
          <span className="flex min-w-0 flex-col leading-tight max-md:hidden">
            <span className="truncate text-[12px] font-medium">{cur?.email || value || '…'}</span>
            {cur?.name && <span className="truncate text-[11px] text-muted">{cur.name}</span>}
          </span>
          <ChevronDown size={13} className="shrink-0 text-muted" />
        </button>
      </Tip>
      <Popover anchor={anchor} onClose={() => setAnchor(null)} align="end" above={above} className="w-[300px] max-w-[calc(100vw-16px)]">
        <div className="px-3 pb-1 pt-0.5 text-[11.5px] font-medium text-muted">{t('Send from')}</div>
        <div className="max-h-[320px] overflow-y-auto">
          {identities.map((i) => (
            <button key={i.email} onClick={() => (onChange(i.email), setAnchor(null))} className="flex w-full items-center gap-2.5 px-3 py-1.5 text-left hover:bg-hover">
              <Avatar addr={{ email: i.email, name: i.name }} size={26} />
              <span className="min-w-0 flex-1">
                <span className="block truncate text-[13px] font-semibold">{i.email}</span>
                {i.name && <span className="block truncate text-[12px] text-muted">{i.name}</span>}
              </span>
              {i.email === value && <Check size={15} className="shrink-0 text-accent" />}
            </button>
          ))}
        </div>
      </Popover>
    </>
  )
}

/** Popover under the signature handle: the signatures to choose from (small previews), hide, edit in Settings. */
function SignaturePicker({ anchor, onClose, signatures, current, enabled, account, onPick, onHide, above }: {
  anchor: DOMRect | null
  onClose: () => void
  signatures: Signature[]
  current: number | null
  enabled: boolean
  account: string
  onPick: (id: number) => void
  onHide: () => void
  above?: boolean
}) {
  return (
    <Popover anchor={anchor} onClose={onClose} above={above} className="w-[330px] max-w-[calc(100vw-16px)]">
      <div className="flex items-center gap-2 px-3 pb-1.5">
        <span className="min-w-0 flex-1">
          <span className="block text-[12.5px] font-semibold">{t('Signature')}</span>
          {account && <span className="block truncate text-[11.5px] text-muted">{t('Used for every message from {email}', { email: account })}</span>}
        </span>
        <TipButton size="sm" label={t('Edit signatures in Settings')} onClick={() => (onClose(), openSettings('signatures'))}>
          <Settings size={14} />
        </TipButton>
      </div>
      <div className="max-h-[300px] overflow-y-auto">
        {signatures.map((s) => (
          <button key={s.id} onClick={() => (onPick(s.id), onClose())} className="flex w-full items-start gap-2 px-3 py-1.5 text-left hover:bg-hover">
            <span className="min-w-0 flex-1">
              <span className="block truncate text-[13px] font-medium">{s.name}</span>
              <span className="mt-1 block max-h-[58px] overflow-hidden rounded-md border border-line bg-surface-2 px-2 py-1.5">
                <span className="pointer-events-none block origin-top-left text-[13px] text-fg" style={{ transform: 'scale(0.72)', width: `${100 / 0.72}%` }} dangerouslySetInnerHTML={{ __html: s.html }} />
              </span>
            </span>
            {enabled && current === s.id && <Check size={15} className="mt-0.5 shrink-0 text-accent" />}
          </button>
        ))}
        {!signatures.length && <div className="px-3 py-2 text-[12.5px] text-muted">{t('No signatures yet — add one in Settings.')}</div>}
      </div>
      <div className="my-1 border-t border-line" />
      <button disabled={!enabled} onClick={() => (onHide(), onClose())} className="flex w-full items-center gap-2.5 px-3 py-1.5 text-left text-[13px] hover:bg-hover disabled:opacity-40">
        <EyeOff size={14} className="text-muted" /> {t('Hide signature')}
      </button>
    </Popover>
  )
}

function Chip({ icon, children, onClick, disabled }: { icon: React.ReactNode; children: React.ReactNode; onClick: (e: React.MouseEvent<HTMLButtonElement>) => void; disabled?: boolean }) {
  return (
    <button
      disabled={disabled}
      onClick={onClick}
      className="inline-flex h-7 shrink-0 items-center gap-1.5 rounded-full bg-surface-2 px-3 text-[12.5px] text-fg transition-colors hover:bg-hover disabled:opacity-50"
    >
      <span className="text-accent">{icon}</span>
      {children}
    </button>
  )
}

export default function Composer({ request }: { request: ComposerRequest }) {
  const { closeComposer, toast, settings } = useStore()
  const accounts = useStore((s) => s.accounts)
  const view = useStore((s) => s.view)
  const narrow = useNarrow()
  const [draft, setDraft] = useState<DraftView | null>(null)
  const [from, setFrom] = useState('')
  const [to, setTo] = useState<Address[]>([])
  const [cc, setCc] = useState<Address[]>([])
  const [bcc, setBcc] = useState<Address[]>([])
  const [showCc, setShowCc] = useState(false)
  // new messages start with one "To, Cc, Bcc" line; it opens into the fields
  const [recipOpen, setRecipOpen] = useState(false)
  const [focusTo, setFocusTo] = useState(false)
  const [subject, setSubject] = useState('')
  const [attachments, setAttachments] = useState<DraftAttachment[]>([])
  const [signature, setSignature] = useState(true)
  const [signatures, setSignatures] = useState<Signature[]>([])
  const [sigAnchor, setSigAnchor] = useState<DOMRect | null>(null)
  const [remindAt, setRemindAt] = useState<number | null>(null)
  const [identities, setIdentities] = useState<Identity[]>([])
  const [saving, setSaving] = useState(false)
  const [sending, setSending] = useState(false)
  const [aiBusy, setAiBusy] = useState(false)
  const [menus, setMenus] = useState<{ which: 'send' | 'remind' | 'ai' | 'rewrite' | 'tpl'; x: number; y: number } | null>(null)
  const [templates, setTemplates] = useState<Template[]>([])
  const [expanded, setExpanded] = useState(false)
  const [dragOver, setDragOver] = useState(false)
  const dirty = useRef(false)
  const saveTimer = useRef<ReturnType<typeof setTimeout> | null>(null)
  const draftRef = useRef<DraftView | null>(null)
  const subjectRef = useRef<HTMLInputElement>(null)
  draftRef.current = draft

  const editor = useEditor({
    extensions: [
      StarterKit.configure({ link: { openOnClick: false, autolink: true }, heading: { levels: [2, 3] } }),
      Placeholder.configure({ placeholder: request.mode === 'new' || request.mode === 'again' ? t('Write your message…') : t('Write a reply…') }),
    ],
    content: '',
    onUpdate: () => {
      dirty.current = true
      scheduleSave()
    },
    editorProps: {
      handlePaste: (_view, event) => {
        const files = Array.from(event.clipboardData?.files || [])
        if (!files.length) return false
        void addFiles(files)
        return true
      },
    },
  })

  const loadSignatures = async () => {
    const [ids, sigs] = await Promise.all([api.listIdentities(), api.listSignatures()])
    setIdentities(ids as Identity[])
    setSignatures(sigs)
  }

  // initialise the draft from the request
  useEffect(() => {
    let cancelled = false
    void (async () => {
      try {
        const [ids, sigs] = await Promise.all([api.listIdentities(), api.listSignatures()])
        if (!cancelled) (setIdentities(ids as Identity[]), setSignatures(sigs))
        let d: DraftView
        const pre = request.prefill
        // replying in a conversation that already has an unsent reply continues that draft
        const existing =
          request.mode !== 'new' && request.mode !== 'edit' && request.mode !== 'again' && request.threadId && !pre?.html
            ? (await api.getThread(request.threadId))?.drafts.find((x) => x.status === 'draft' && (x.reply_kind === 'forward') === (request.mode === 'forward'))
            : undefined
        if (request.mode === 'edit' && request.draftId) d = await api.getDraft(request.draftId)
        else if (existing) d = existing
        else if (request.mode === 'reply' || request.mode === 'replyall') d = await api.saveDraft({ reply_to_message_id: request.messageId, reply_all: request.mode === 'replyall', html: pre?.html })
        else if (request.mode === 'forward') d = await api.saveDraft({ forward_of_message_id: request.messageId })
        else if (request.mode === 'again' && request.messageId) d = await api.sendAgain(request.messageId)
        else d = await api.saveDraft({ to: pre?.to, subject: pre?.subject, html: pre?.html })
        if (cancelled) return
        setDraft(d)
        useStore.getState().setComposerDraft(d.id)
        setFrom(d.from_email || '')
        setTo(d.to)
        setCc(d.cc)
        setBcc(d.bcc)
        setShowCc(d.cc.length > 0 || d.bcc.length > 0)
        setRecipOpen(request.mode !== 'new' || d.to.length + d.cc.length + d.bcc.length > 0 || !!d.reply_to_message_id || !!d.forward_of_message_id)
        setSubject(d.subject)
        setAttachments(d.attachments)
        setSignature(d.signature)
        setRemindAt(d.remind_at)
        editor?.commands.setContent(stripSignatureHtml(d.html || '').replace(/^<p><\/p>$/, ''), { emitUpdate: false })
        setTimeout(() => {
          if (request.mode === 'new' && !d.subject && !request.inline) subjectRef.current?.focus()
          else editor?.commands.focus(request.mode === 'new' ? undefined : 'start')
        }, 30)
      } catch (e) {
        toast({ level: 'error', message: errorText(e) })
        closeComposer()
      }
    })()
    return () => {
      cancelled = true
    }
  }, [request.key, editor])

  // signatures may have been edited in Settings (opened from the signature picker)
  const seenView = useRef(view)
  useEffect(() => {
    if (seenView.current === 'settings' && view !== 'settings') void loadSignatures()
    seenView.current = view
  }, [view])

  const collect = useCallback(() => ({
    id: draftRef.current!.id,
    from_email: from || undefined,
    to, cc, bcc, subject,
    html: editor?.getHTML() || '',
    attachments,
    signature,
  }), [from, to, cc, bcc, subject, attachments, signature, editor])

  const save = useCallback(async () => {
    if (!draftRef.current) return null
    setSaving(true)
    try {
      const d = await api.saveDraft(collect())
      dirty.current = false
      return d
    } catch (e) {
      toast({ level: 'error', message: errorText(e) })
      return null
    } finally {
      setSaving(false)
    }
  }, [collect])

  const scheduleSave = () => {
    if (saveTimer.current) clearTimeout(saveTimer.current)
    saveTimer.current = setTimeout(() => void saveRef.current(), 1200)
  }
  const saveRef = useRef(save)
  saveRef.current = save

  useEffect(() => {
    if (draft) {
      dirty.current = true
      scheduleSave()
    }
  }, [from, to, cc, bcc, subject, attachments, signature])

  // leaving the composer (navigating away, closing a thread) never loses typed text
  useEffect(() => () => {
    if (saveTimer.current) clearTimeout(saveTimer.current)
    if (dirty.current && draftRef.current) void saveRef.current()
  }, [])

  const isEmpty = () => !to.length && !cc.length && !subject.trim() && !(editor?.getText().trim()) && !attachments.length

  const close = async (discardIfEmpty = true) => {
    if (saveTimer.current) clearTimeout(saveTimer.current)
    if (draft) {
      if (discardIfEmpty && isEmpty() && request.mode !== 'edit') await api.deleteDraft(draft.id).catch(() => undefined)
      else if (dirty.current) await save()
    }
    closeComposer()
  }

  const discard = async () => {
    if (draft && !window.confirm(t('Delete this draft?'))) return
    if (saveTimer.current) clearTimeout(saveTimer.current)
    dirty.current = false
    if (draft) await api.deleteDraft(draft.id).catch(() => undefined)
    closeComposer()
  }

  const addFiles = async (files: File[]) => {
    const added: DraftAttachment[] = []
    for (const f of files) {
      let p = ''
      try {
        p = window.octo.filePath(f)
      } catch {
        p = ''
      }
      if (p) added.push({ filename: f.name, path: p, size: f.size, mime: f.type || undefined })
      else {
        const staged = await api.stageAttachment(f.name || t('pasted-image.png'), new Uint8Array(await f.arrayBuffer()))
        added.push({ ...staged, mime: f.type || undefined })
      }
    }
    const big = added.find((a) => (a.size || 0) > 25 * 1024 * 1024)
    if (big) toast({ level: 'error', message: t('File {name} is over 25 MB — most servers will reject it.', { name: big.filename }) })
    setAttachments((a) => [...a, ...added])
  }

  const send = async (sendAt?: number) => {
    if (!draft) return
    const all = [...to, ...cc, ...bcc]
    if (!all.length) {
      toast({ level: 'error', message: t('Add at least one recipient') })
      return
    }
    if (!subject.trim() && !window.confirm(t('Send the message without a subject?'))) return
    const body = editor?.getText() || ''
    if (/(w załącznik|załączam|w załączeniu|attach(ed|ment))/i.test(body) && !attachments.length && !window.confirm(t('You mention an attachment, but nothing is attached. Send anyway?'))) return
    setSending(true)
    try {
      if (saveTimer.current) clearTimeout(saveTimer.current)
      await api.saveDraft(collect())
      dirty.current = false
      const d = await api.sendDraft(draft.id, { sendAt, remindAt: remindAt ?? undefined })
      closeComposer()
      const id = d.id
      const reopen = async () => {
        try {
          await api.cancelSend(id)
          useStore.getState().compose({ mode: 'edit', draftId: id, threadId: request.threadId, inline: request.inline })
        } catch (e) {
          toast({ level: 'error', message: errorText(e) })
        }
      }
      if (sendAt) toast({ level: 'success', message: t('Scheduled for {when}', { when: formatWhen(sendAt) }), action: { label: t('Undo'), run: () => void reopen() } })
      else toast({ level: 'info', message: settings?.undoSendSeconds ? t('Sending in {s} s…', { s: settings.undoSendSeconds }) : t('Sending…'), action: settings?.undoSendSeconds ? { label: t('Undo'), run: () => void reopen() } : undefined, ttl: (settings?.undoSendSeconds || 3) * 1000 })
    } catch (e) {
      toast({ level: 'error', message: errorText(e) })
    } finally {
      setSending(false)
    }
  }

  const runAi = async (mode: string) => {
    if (!editor || !draft) return
    setAiBusy(true)
    try {
      if (mode === 'reply' && request.threadId) {
        const instr = await askText(t('What should the reply say? (optional)'), '', t('e.g. agree to Friday 10:00, ask about the budget'))
        editor.commands.setContent('')
        let acc = ''
        const r = await stream<{ text: string }>('aiDraftReply', [request.threadId, { instructions: instr || undefined }], (d) => {
          acc += d
          editor.commands.setContent(mdToHtml(acc), { emitUpdate: false })
        })
        editor.commands.setContent(mdToHtml(r.text))
      } else if (mode === 'compose' || mode === 'introduce') {
        let prompt: string | null
        if (mode === 'introduce') {
          const who = await askText(t('Who are you introducing, and to whom?'), '', t('e.g. Marta, our designer, to Tom from the print shop'))
          if (!who) return
          prompt = t('Write a short, friendly email that introduces two people to each other: {who}. Say in a sentence or two why they should talk and suggest how they could get in touch.', { who })
        } else {
          prompt = await askText(t('What should the message be about?'), '', t('e.g. thank them for the meeting and send a summary of what we agreed'))
        }
        if (!prompt) return
        const accountId = identities.find((i) => i.email === from)?.account_id
        const r = await api.aiCompose(prompt, accountId)
        if (r.subject && !subject) setSubject(r.subject)
        editor.commands.setContent(mdToHtml(r.body))
      } else {
        const { from: a, to: b } = editor.state.selection
        const selected = a !== b ? editor.state.doc.textBetween(a, b, '\n') : ''
        const text = selected || editor.getText()
        if (!text.trim()) return
        let custom: string | undefined
        if (mode === 'custom') {
          custom = (await askText(t('How should the text change?'), '', t('e.g. add an apology for the delay'))) || undefined
          if (!custom) return
        }
        const r = await api.aiRewrite(text, mode as never, custom)
        if (selected) editor.chain().focus().insertContentAt({ from: a, to: b }, mdToHtml(r.text)).run()
        else editor.commands.setContent(mdToHtml(r.text))
      }
      dirty.current = true
      scheduleSave()
    } catch (e) {
      toast({ level: 'error', message: errorText(e) })
    } finally {
      setAiBusy(false)
    }
  }

  const insertTemplate = async (tpl: Template) => {
    if (!editor) return
    try {
      const manual = tpl.placeholders.filter((p) => !/recipient|odbiorc|my |moje|^me\b/i.test(p))
      const values: Record<string, string> = {}
      for (const p of manual) {
        const v = await askText(t('Template “{name}”: {field}', { name: tpl.name, field: p }))
        if (v === null) return
        values[p] = v
      }
      await api.saveDraft({ ...collect(), template_id: tpl.id, placeholders: values, html: editor.getHTML() })
      const d = await api.getDraft(draft!.id)
      setSubject(d.subject)
      if (!to.length) setTo(d.to)
      if (d.to.length) setRecipOpen(true)
      editor.commands.setContent(stripSignatureHtml(d.html))
    } catch (e) {
      toast({ level: 'error', message: errorText(e) })
    }
  }

  // ----- signature: the one the server appends for the sending address (see signatureHtml in core/drafts) -----
  const ident = identities.find((i) => i.email === from)
  const accountId = ident?.account_id
  const sigId =
    identities
      .filter((i) => i.account_id === accountId && i.signature_id != null)
      .sort((a, b) => Number(b.email === from) - Number(a.email === from) || b.is_default - a.is_default)[0]?.signature_id ?? null
  const sigHtml = signature ? signatures.find((s) => s.id === sigId)?.html : undefined
  const accountEmail = accounts.find((a) => a.id === accountId)?.email || ''

  const pickSignature = async (id: number) => {
    setSignature(true)
    try {
      if (accountId && id !== sigId) {
        await api.setDefaultSignature(accountId, id)
        await loadSignatures()
      }
      // the server swaps the signature on the next save
      dirty.current = true
      scheduleSave()
    } catch (e) {
      toast({ level: 'error', message: errorText(e) })
    }
  }

  const canReply = !!request.threadId && request.mode !== 'new'
  const rewriteItems: MenuItem[] = [
    { label: t('Fix mistakes'), onClick: () => void runAi('proofread') },
    { label: t('Make shorter'), onClick: () => void runAi('shorter') },
    { label: t('Make longer'), onClick: () => void runAi('longer') },
    { label: t('More formal'), onClick: () => void runAi('formal') },
    { label: t('More friendly'), onClick: () => void runAi('friendly') },
    { label: t('Translate to English'), onClick: () => void runAi('english') },
    { label: t('Translate to Polish'), onClick: () => void runAi('polish') },
    { label: t('Custom instruction…'), onClick: () => void runAi('custom') },
  ]
  const aiItems: MenuItem[] = [
    ...(canReply ? [{ label: t('Write a reply (AI)'), icon: <Sparkles size={14} />, onClick: () => void runAi('reply') }] : []),
    { label: t('Write from a prompt…'), icon: <Sparkles size={14} />, onClick: () => void runAi('compose') },
    { label: t('Introduce someone…'), icon: <Handshake size={14} />, onClick: () => void runAi('introduce') },
    { separator: true, label: '' },
    ...rewriteItems,
  ]

  /** Opens a menu next to the clicked control: below it, or above it for the bottom bar of the inline composer. */
  const openMenu = (which: NonNullable<typeof menus>['which'], el: HTMLElement, up: boolean, height: number) => {
    const r = el.getBoundingClientRect()
    setMenus({ which, x: r.left, y: up ? r.top - height - 4 : r.bottom + 4 })
  }

  const isReply = request.mode === 'reply' || request.mode === 'replyall' || draft?.reply_kind === 'reply' || draft?.reply_kind === 'replyall'
  const inline = request.inline

  const actions = (up: boolean) => (
    <>
      <Tip label={t('AI: write and edit')}>
        <button
          onClick={(e) => openMenu('ai', e.currentTarget, up, 380)}
          className="mr-1 inline-flex h-7 items-center gap-1 rounded-full bg-accent-soft px-2.5 text-[12px] font-semibold text-accent transition-[filter] hover:brightness-95"
        >
          {aiBusy ? <Loader2 size={13} className="animate-spin" /> : <Sparkles size={13} />} AI
        </button>
      </Tip>
      <TipButton label={t('Attach files')} onClick={async () => setAttachments([...attachments, ...(await window.octo.pickFiles())])}><Paperclip size={16} /></TipButton>
      <TipButton label={t('Templates')} onClick={async (e) => {
        const el = e.currentTarget
        setTemplates(await api.listTemplates())
        openMenu('tpl', el, up, 240)
      }}><FileText size={16} /></TipButton>
      <TipButton
        label={remindAt ? t('I’ll remind you {when} if no one replies', { when: formatWhen(remindAt) }) : t('Remind me if no reply')}
        active={!!remindAt}
        onClick={(e) => (remindAt ? setRemindAt(null) : openMenu('remind', e.currentTarget, up, 280))}
      >
        <Bell size={16} />
      </TipButton>
      <TipButton label={t('Send later')} disabled={sending || !draft} onClick={(e) => openMenu('send', e.currentTarget, up, 280)}><Clock size={16} /></TipButton>
    </>
  )

  const identityMenu = <IdentityMenu identities={identities} value={from} onChange={setFrom} above={inline} />

  const recipients = recipOpen ? (
    <>
      <div className="relative">
        <RecipientInput label={t('To')} value={to} onChange={setTo} autoFocus={focusTo} />
        {!showCc && (
          <button className="absolute right-4 top-2 text-[12px] text-muted hover:text-fg" onClick={() => setShowCc(true)}>{t('Cc / Bcc')}</button>
        )}
      </div>
      {showCc && <RecipientInput label={t('Cc')} value={cc} onChange={setCc} />}
      {showCc && <RecipientInput label={t('Bcc')} value={bcc} onChange={setBcc} />}
    </>
  ) : (
    <button
      className="flex h-10 w-full shrink-0 items-center border-b border-line px-4 text-left text-[13.5px] text-muted hover:text-fg"
      onClick={() => (setFocusTo(true), setShowCc(true), setRecipOpen(true))}
    >
      {t('To, Cc, Bcc')}
    </button>
  )

  const chips = (
    <div className={cx('flex shrink-0 gap-1.5 overflow-x-auto px-4', inline ? 'pt-2' : 'py-2.5')}>
      <Chip icon={<Sparkles size={13} />} disabled={aiBusy || !draft} onClick={() => void runAi(canReply ? 'reply' : 'compose')}>{t('Write a draft')}</Chip>
      <Chip icon={<Wand2 size={13} />} disabled={aiBusy || !draft} onClick={(e) => openMenu('rewrite', e.currentTarget, false, 0)}>{t('Rewrite…')}</Chip>
      <Chip icon={<Handshake size={13} />} disabled={aiBusy || !draft} onClick={() => void runAi('introduce')}>{t('Introduce someone…')}</Chip>
    </div>
  )

  const signatureBlock = (
    <div className="mt-3 flex items-start gap-1" onClick={(e) => e.stopPropagation()}>
      <TipButton
        size="sm"
        label={t('Choose signature')}
        className="-ml-2 shrink-0"
        active={!!sigAnchor}
        onMouseDown={(e) => e.nativeEvent.stopPropagation()}
        onClick={(e) => setSigAnchor(sigAnchor ? null : e.currentTarget.getBoundingClientRect())}
      >
        <ChevronsUpDown size={14} />
      </TipButton>
      {sigHtml ? (
        <div className="selectable min-w-0 flex-1 pt-1 text-[13px] text-muted [&_a]:text-accent" dangerouslySetInnerHTML={{ __html: sigHtml }} />
      ) : (
        <span className="pt-1.5 text-[12.5px] text-faint">{signature ? t('No signature for this address') : t('Signature hidden')}</span>
      )}
    </div>
  )

  const quoteNote = (request.mode === 'reply' || request.mode === 'replyall' || request.mode === 'forward' || draft?.reply_to_message_id || draft?.forward_of_message_id) && (
    <div className="mt-2 select-none text-[12px] text-faint">{draft?.reply_kind === 'forward' || request.mode === 'forward' ? t('The forwarded message (with attachments) will be included') : t('The conversation history will be included as a quote')}</div>
  )

  const attachmentList = attachments.length > 0 && (
    <div className="flex shrink-0 flex-wrap gap-1.5 border-t border-line px-3 py-2">
      {attachments.map((a, i) => (
        <span key={a.path + i} className="inline-flex items-center gap-1.5 rounded-lg border border-line bg-surface-2 px-2 py-1 text-[12px]">
          <FileText size={13} className="text-muted" /> {a.filename} {a.size ? <span className="text-faint">{fileSize(a.size)}</span> : null}
          <button aria-label={t('Remove')} onClick={() => setAttachments(attachments.filter((_, j) => j !== i))}><X size={12} /></button>
        </span>
      ))}
    </div>
  )

  const savedState = saving ? <span className="text-[11.5px] text-faint">{t('Saving…')}</span> : draft ? <span className="text-[11.5px] text-faint">{t('Saved')}</span> : <Spinner />
  const reminderNote = remindAt && <span className="flex items-center gap-1 text-[11.5px] text-accent max-md:hidden"><Bell size={12} /> {t('reminder {when}', { when: formatWhen(remindAt) })}</span>

  const body = (
    <div
      className={cx(
        'flex flex-col overflow-hidden bg-surface',
        inline ? 'rounded-xl border shadow-sm' : 'h-full rounded-2xl border max-md:rounded-none max-md:border-0',
        dragOver ? 'border-accent' : 'border-line',
      )}
      onDragOver={(e) => (e.preventDefault(), setDragOver(true))}
      onDragLeave={() => setDragOver(false)}
      onDrop={(e) => {
        e.preventDefault()
        setDragOver(false)
        void addFiles(Array.from(e.dataTransfer.files))
      }}
      onKeyDown={(e) => {
        if ((e.ctrlKey || e.metaKey) && e.key === 'Enter') {
          e.preventDefault()
          void send()
        }
        if (e.key === 'Escape') {
          e.stopPropagation()
          void close()
        }
      }}
    >
      {!inline && (
        <div className="flex h-12 shrink-0 items-center gap-0.5 px-2">
          <TipButton label={t('Close (saves the draft)')} kbd="Esc" onClick={() => void close()}><X size={17} /></TipButton>
          {!narrow && <TipButton label={expanded ? t('Shrink') : t('Expand')} onClick={() => setExpanded(!expanded)}>{expanded ? <Minimize2 size={15} /> : <Maximize2 size={15} />}</TipButton>}
          <span className="min-w-0 flex-1" />
          {actions(false)}
          {identityMenu}
          <Tip label={t('Send')} kbd="Ctrl+Enter">
            <button
              aria-label={t('Send')}
              disabled={sending || !draft}
              onClick={() => void send()}
              className="ml-1 flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-accent text-accent-fg transition-[filter] hover:brightness-110 disabled:opacity-45"
            >
              {sending ? <Loader2 size={15} className="animate-spin" /> : <Send size={15} />}
            </button>
          </Tip>
        </div>
      )}

      {(!inline || !isReply) && (
        <input
          ref={subjectRef}
          value={subject}
          onChange={(e) => setSubject(e.target.value)}
          onKeyDown={(e) => {
            if (e.key !== 'Enter') return
            e.preventDefault()
            if (!recipOpen) (setFocusTo(true), setRecipOpen(true))
            else editor?.commands.focus('start')
          }}
          placeholder={t('Subject')}
          className={cx(
            'w-full shrink-0 bg-transparent px-4 font-semibold outline-none placeholder:text-faint no-focus-ring',
            inline ? 'h-10 border-b border-line text-[15px]' : 'pb-2 pt-1 text-[26px] leading-tight max-md:text-[22px]',
          )}
        />
      )}
      {recipients}
      {chips}

      <div className={cx('min-h-0 flex-1 overflow-y-auto px-4 py-3', inline && 'max-h-[460px] [&_.tiptap]:min-h-[90px]')} onClick={() => editor?.commands.focus()}>
        <EditorContent editor={editor} />
        {signatureBlock}
        {quoteNote}
      </div>
      {attachmentList}

      {inline ? (
        <div className="flex shrink-0 flex-wrap items-center gap-0.5 border-t border-line px-2 py-1.5">
          <Tip label={t('Send')} kbd="Ctrl+Enter">
            <button
              disabled={sending || !draft}
              onClick={() => void send()}
              className="mr-1 inline-flex h-8 items-center gap-1.5 rounded-full bg-accent px-4 text-[13px] font-medium text-accent-fg transition-[filter] hover:brightness-110 disabled:opacity-45"
            >
              {sending ? <Spinner /> : <Send size={14} />} {t('Send')}
            </button>
          </Tip>
          {actions(true)}
          {/* text formatting does not fit next to the other tools on a phone */}
          <div className="contents max-md:hidden">
            <div className="mx-1 h-5 w-px bg-line" />
            <Toolbar editor={editor} />
          </div>
          <span className="flex-1" />
          {reminderNote}
          <span className="mx-1 max-md:hidden">{savedState}</span>
          {identityMenu}
          <TipButton label={t('Delete draft')} onClick={() => void discard()}><Trash2 size={15} /></TipButton>
          <TipButton label={t('Close (saves the draft)')} kbd="Esc" onClick={() => void close()}><X size={15} /></TipButton>
        </div>
      ) : (
        <div className="flex h-10 shrink-0 items-center gap-1 border-t border-line px-2">
          <div className="max-md:hidden">
            <Toolbar editor={editor} />
          </div>
          <span className="flex-1" />
          {reminderNote}
          <span className="mx-1">{savedState}</span>
          <TipButton label={t('Delete draft')} onClick={() => void discard()}><Trash2 size={15} /></TipButton>
        </div>
      )}

      <WhenMenu kind="send" anchor={menus?.which === 'send' ? menus : null} onClose={() => setMenus(null)} onPick={(ts) => void send(ts)} />
      <WhenMenu kind="remind" anchor={menus?.which === 'remind' ? menus : null} onClose={() => setMenus(null)} onPick={(ts) => (setRemindAt(ts), (dirty.current = true))} />
      <Menu items={aiItems} anchor={menus?.which === 'ai' ? menus : null} onClose={() => setMenus(null)} />
      <Menu items={rewriteItems} anchor={menus?.which === 'rewrite' ? menus : null} onClose={() => setMenus(null)} />
      <Menu
        items={templates.length ? templates.map((tpl) => ({ label: tpl.name, hint: tpl.subject || '', onClick: () => void insertTemplate(tpl) })) : [{ label: t('No templates — add them in Settings'), disabled: true }]}
        anchor={menus?.which === 'tpl' ? menus : null}
        onClose={() => setMenus(null)}
      />
      <SignaturePicker
        anchor={sigAnchor}
        onClose={() => setSigAnchor(null)}
        signatures={signatures}
        current={sigId}
        enabled={signature}
        account={accountEmail}
        onPick={(id) => void pickSignature(id)}
        onHide={() => setSignature(false)}
        above={inline}
      />
    </div>
  )

  if (inline) return <div className="anim-in">{body}</div>
  return (
    <div className="fixed inset-0 z-40 box-border flex items-center justify-center bg-scrim max-md:pt-[env(safe-area-inset-top)] max-md:pb-[env(safe-area-inset-bottom)]" onMouseDown={(e) => !isNarrow() && e.target === e.currentTarget && void close()}>
      <div
        className={cx('anim-in flex flex-col rounded-2xl', expanded ? 'h-[92vh] w-[92vw]' : 'h-[80vh] w-[800px] max-w-[94vw]', 'max-md:h-full max-md:w-full max-md:max-w-none max-md:rounded-none')}
        style={{ boxShadow: 'var(--shadow)' }}
      >
        {body}
      </div>
    </div>
  )
}
