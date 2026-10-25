// Home-server pieces that need no mail server: the secrets file shared by the service and the
// `octo` CLI, and recovery after a crashed engine (systemd restarts it at once).
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import assert from 'node:assert/strict'
import { spawnSync } from 'node:child_process'
import { describe, it } from 'node:test'

process.env.OPENMAIL_HOME = fs.mkdtempSync(path.join(os.tmpdir(), 'octo-home-unit-'))
process.env.OPENMAIL_SECRETS = 'server'
process.env.OPENMAIL_QUIET = '1'

import { engineRunning } from '../src/core/boot'
import { getSecret, secretStoreName, setSecret } from '../src/core/secrets'
import { setKV } from '../src/core/settings'

const file = path.join(process.env.OPENMAIL_HOME, 'secrets.json')

/** What another process (the CLI next to the service) does: rewrite the file. */
function writeFromOtherProcess(change: (s: Record<string, string>) => void) {
  const data = JSON.parse(fs.readFileSync(file, 'utf8')) as Record<string, string>
  change(data)
  fs.writeFileSync(file, JSON.stringify(data))
  const t = new Date(Date.now() + 5000)
  fs.utimesSync(file, t, t)
}

describe('home server without a mail server', () => {
  it('keeps secrets in a private file', () => {
    setSecret('account:1', 'haslo-1')
    assert.equal(getSecret('account:1'), 'haslo-1')
    assert.ok(fs.existsSync(file))
    if (process.platform !== 'win32') assert.equal(fs.statSync(file).mode & 0o777, 0o600)
    assert.match(secretStoreName(), /home server|serwerze domowym/)
  })

  it('sees secrets written by another process and does not overwrite them', () => {
    writeFromOtherProcess((s) => (s['account:2'] = 'haslo-2'))
    assert.equal(getSecret('account:2'), 'haslo-2')
    setSecret('account:3', 'haslo-3')
    const onDisk = JSON.parse(fs.readFileSync(file, 'utf8')) as Record<string, string>
    assert.deepEqual(Object.keys(onDisk).sort(), ['account:1', 'account:2', 'account:3'])
    writeFromOtherProcess((s) => delete s['account:1'])
    assert.equal(getSecret('account:1'), null)
  })

  it('ignores the fresh heartbeat of a crashed engine on this machine', () => {
    const dead = spawnSync(process.execPath, ['-e', '0']).pid!
    setKV('engine', { owner: 'server', pid: dead, host: os.hostname(), at: Date.now() })
    assert.equal(engineRunning(), null)
    // a live engine still blocks a second one
    setKV('engine', { owner: 'server', pid: process.ppid, host: os.hostname(), at: Date.now() })
    assert.equal(engineRunning()?.pid, process.ppid)
    // an engine on another machine (shared folder) is trusted by its heartbeat alone
    setKV('engine', { owner: 'app', pid: dead, host: 'inny-komputer', at: Date.now() })
    assert.equal(engineRunning()?.owner, 'app')
    setKV('engine', null)
  })
})

describe('reverse proxy awareness', () => {
  const req = (xff: string | undefined, proto?: string) =>
    ({ headers: { 'x-forwarded-for': xff, 'x-forwarded-proto': proto }, socket: { remoteAddress: '::ffff:172.17.0.1' } }) as never
  it('ignores X-Forwarded-For unless OCTO_TRUST_PROXY=1', async () => {
    const { clientIp, secureFlag } = await import('../src/server/server')
    delete process.env.OPENMAIL_TRUST_PROXY
    assert.equal(clientIp(req('203.0.113.9, 10.0.0.1')), '172.17.0.1')
    assert.equal(secureFlag(req('203.0.113.9', 'https')), '')
    process.env.OPENMAIL_TRUST_PROXY = '1'
    assert.equal(clientIp(req('203.0.113.9, 10.0.0.1')), '203.0.113.9')
    assert.equal(clientIp(req(undefined)), '172.17.0.1')
    assert.equal(secureFlag(req('203.0.113.9', 'https')), '; Secure')
    delete process.env.OPENMAIL_TRUST_PROXY
  })
})

describe('Infomaniak preset', () => {
  it('is picked for Infomaniak free domains and points at mail.infomaniak.com', async () => {
    const { discover, PRESETS } = await import('../src/core/providers')
    const cfg = await discover('me@ik.me')
    assert.equal(cfg?.provider, 'infomaniak')
    assert.deepEqual([cfg?.imap_host, cfg?.imap_port, cfg?.imap_secure], ['mail.infomaniak.com', 993, true])
    assert.deepEqual([cfg?.smtp_host, cfg?.smtp_port, cfg?.smtp_secure], ['mail.infomaniak.com', 465, true])
    assert.ok(PRESETS.infomaniak.hint)
  })
})

describe('categorize: French and Spanish senders', () => {
  it('routes automatic and promotional mail', async () => {
    const { categorize } = await import('../src/core/smart')
    const c = (fromEmail: string, extra: object = {}) => categorize({ fromEmail, ...extra })
    assert.equal(c('ne-pas-repondre@banque.fr'), 'notification')
    assert.equal(c('facture@fournisseur.fr'), 'notification')
    assert.equal(c('no-responder@tienda.es'), 'notification')
    assert.equal(c('pedidos@tienda.es'), 'notification')
    assert.equal(c('noreply@impots.gouv.fr'), 'notification')
    assert.equal(c('promotions@marque.fr', { listUnsubscribe: '<mailto:x@y>' }), 'newsletter')
    assert.equal(c('ofertas@marca.es', { listUnsubscribe: '<mailto:x@y>' }), 'newsletter')
    assert.equal(c('nouveautes@marque.fr', { fromName: 'Marque' }), 'newsletter')
    assert.equal(c('hola@marca.es', { fromName: 'Marca' }), 'newsletter')
    assert.equal(c('jean.dupont@orange.fr', { fromName: 'Jean Dupont' }), 'people')
    assert.equal(c('maria@gmail.com', { fromName: 'María López' }), 'people')
  })
})

describe('OpenAI-compatible AI provider', () => {
  it('calls /chat/completions with the key, streams and reports errors', async () => {
    const http = await import('node:http')
    const seen: { auth?: string; body?: Record<string, unknown> }[] = []
    const srv = http.createServer((req, res) => {
      let raw = ''
      req.on('data', (c) => (raw += c))
      req.on('end', () => {
        const body = JSON.parse(raw) as Record<string, unknown>
        seen.push({ auth: req.headers.authorization, body })
        if (req.headers.authorization !== 'Bearer sk-test') return void res.writeHead(401).end('no')
        if (body.stream) {
          res.writeHead(200, { 'Content-Type': 'text/event-stream' })
          res.write('data: {"choices":[{"delta":{"content":"Hel"}}]}\n\n')
          res.write('data: {"choices":[{"delta":{"content":"lo"}}]}\n\n')
          return void res.end('data: [DONE]\n\n')
        }
        res.writeHead(200, { 'Content-Type': 'application/json' }).end(JSON.stringify({ choices: [{ message: { content: 'Bonjour' } }] }))
      })
    })
    await new Promise<void>((r) => srv.listen(0, '127.0.0.1', r))
    const port = (srv.address() as { port: number }).port
    try {
      const { complete, setOpenaiKey } = await import('../src/core/ai/provider')
      const { updateSettings } = await import('../src/core/settings')
      updateSettings({ ai: { provider: 'openai', openaiUrl: `http://127.0.0.1:${port}/v1/`, openaiModel: 'm1' } } as never)
      setOpenaiKey('sk-test')
      const plain = await complete({ system: 's', messages: [{ role: 'user', content: 'hi' }] })
      assert.deepEqual([plain.text, plain.provider, plain.model], ['Bonjour', 'openai', 'm1'])
      const chunks: string[] = []
      const streamed = await complete({ system: 's', messages: [{ role: 'user', content: 'hi' }], onDelta: (d) => chunks.push(d) })
      assert.equal(streamed.text, 'Hello')
      assert.deepEqual(chunks, ['Hel', 'lo'])
      setOpenaiKey('wrong')
      await assert.rejects(complete({ system: 's', messages: [{ role: 'user', content: 'hi' }] }), /Invalid API key|Nieprawidłowy klucz API/)
    } finally {
      srv.close()
    }
  })
})
