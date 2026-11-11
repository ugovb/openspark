import assert from 'node:assert/strict'
import { describe, it } from 'node:test'
import { isRiskyAttachment } from '../src/main/attachments'

describe('isRiskyAttachment', () => {
  it('flags programs and scripts', () => {
    for (const f of ['setup.exe', 'facture.pdf.exe', 'RUN.CMD', 'x.app', 'install.sh', 'a.desktop', 'macro.docm']) assert.equal(isRiskyAttachment(f), true, f)
  })
  it('lets documents through', () => {
    for (const f of ['rapport.pdf', 'photo.JPG', 'archive.tar.gz', 'noext', '.hidden', 'notes.exe.txt']) assert.equal(isRiskyAttachment(f), false, f)
  })
})
