// Copying the old "Octopus Mail" profile to "OpenMail", and reading old keychain entries.
import assert from 'node:assert/strict'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { describe, it } from 'node:test'
import { migrateLegacyProfile } from '../src/core/migrate'
import { readMigrating } from '../src/core/secrets'

const tmp = () => fs.mkdtempSync(path.join(os.tmpdir(), 'openmail-migrate-'))
const oldProfile = (root: string) => {
  const d = path.join(root, 'Octopus Mail')
  fs.mkdirSync(path.join(d, 'attachments'), { recursive: true })
  fs.writeFileSync(path.join(d, 'octopus.db'), 'DB')
  fs.writeFileSync(path.join(d, 'octopus.db-wal'), 'WAL')
  fs.writeFileSync(path.join(d, 'attachments', 'a.txt'), 'attachment')
  fs.writeFileSync(path.join(d, 'secrets.json'), '{"k":"v"}')
  return d
}

describe('profile migration', () => {
  it('copies everything, renames the database, leaves the old folder intact', () => {
    const root = tmp()
    const old = oldProfile(root)
    assert.deepEqual(migrateLegacyProfile(root), { migrated: true, from: old })
    const dest = path.join(root, 'OpenMail')
    assert.equal(fs.readFileSync(path.join(dest, 'openmail.db'), 'utf8'), 'DB')
    assert.equal(fs.readFileSync(path.join(dest, 'openmail.db-wal'), 'utf8'), 'WAL')
    assert.equal(fs.readFileSync(path.join(dest, 'attachments', 'a.txt'), 'utf8'), 'attachment')
    assert.equal(fs.readFileSync(path.join(dest, 'secrets.json'), 'utf8'), '{"k":"v"}')
    assert.equal(fs.readFileSync(path.join(old, 'octopus.db'), 'utf8'), 'DB')
    assert.deepEqual(fs.readdirSync(root).sort(), ['Octopus Mail', 'OpenMail'])
  })

  it('does nothing the second time, or when the new folder already exists', () => {
    const root = tmp()
    oldProfile(root)
    migrateLegacyProfile(root)
    fs.writeFileSync(path.join(root, 'OpenMail', 'openmail.db'), 'NEWER')
    assert.deepEqual(migrateLegacyProfile(root), { migrated: false })
    assert.equal(fs.readFileSync(path.join(root, 'OpenMail', 'openmail.db'), 'utf8'), 'NEWER')
  })

  it('does nothing without an old profile', () => {
    assert.deepEqual(migrateLegacyProfile(tmp()), { migrated: false })
  })

  it('a stale temporary copy does not block a new migration', () => {
    const root = tmp()
    oldProfile(root)
    fs.mkdirSync(path.join(root, `OpenMail.tmp-${process.pid}`))
    assert.equal(migrateLegacyProfile(root).migrated, true)
  })

  it('waits for another process that holds the lock, then sees its finished copy', async () => {
    const root = tmp()
    oldProfile(root)
    const { spawn } = await import('node:child_process')
    fs.mkdirSync(path.join(root, 'OpenMail.lock'))
    // the other process: finishes its copy after 400 ms (this one blocks while waiting, so it must be a real process)
    const other = `const fs=require('fs'),p=require('path'),r=${JSON.stringify(root)};setTimeout(()=>{fs.cpSync(p.join(r,'Octopus Mail'),p.join(r,'OpenMail'),{recursive:true});fs.rmSync(p.join(r,'OpenMail.lock'),{recursive:true})},400)`
    spawn(process.execPath, ['-e', other], { stdio: 'ignore' })
    assert.deepEqual(migrateLegacyProfile(root), { migrated: false })
    assert.ok(fs.existsSync(path.join(root, 'OpenMail', 'secrets.json')))
  })
})

describe('keychain migration', () => {
  const io = (state: { n: string | null; o: string | null }, failWrite = false) => ({
    getNew: () => state.n,
    getOld: () => state.o,
    setNew: (v: string) => {
      if (failWrite) throw new Error('denied')
      state.n = v
    },
  })
  it('new entry wins', () => {
    const s = { n: 'new', o: 'old' }
    assert.equal(readMigrating(io(s)), 'new')
  })
  it('copies the old entry to the new name and keeps the old one', () => {
    const s = { n: null as string | null, o: 'old' as string | null }
    assert.equal(readMigrating(io(s)), 'old')
    assert.equal(s.n, 'old')
    assert.equal(s.o, 'old')
  })
  it('still returns the old value when writing the copy fails', () => {
    const s = { n: null as string | null, o: 'old' as string | null }
    assert.equal(readMigrating(io(s, true)), 'old')
    assert.equal(s.n, null)
  })
  it('null when neither exists', () => {
    assert.equal(readMigrating(io({ n: null, o: null })), null)
  })
})
