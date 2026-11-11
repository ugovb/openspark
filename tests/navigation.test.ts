import assert from 'node:assert/strict'
import path from 'node:path'
import { pathToFileURL } from 'node:url'
import { describe, it } from 'node:test'
import { isInternalUrl } from '../src/main/navigation'

const indexFile = path.resolve('/opt/OpenMail/out/renderer/index.html')
const dev = { devUrl: 'http://localhost:5173/', indexFile }

describe('isInternalUrl', () => {
  it('accepts the dev server, with a query', () => assert.equal(isInternalUrl('http://localhost:5173/?thread=4', dev), true))
  it('rejects look-alike hosts and other ports', () => {
    assert.equal(isInternalUrl('http://localhost.evil.test/', dev), false)
    assert.equal(isInternalUrl('http://localhost:6000/', dev), false)
    assert.equal(isInternalUrl('https://example.com/', dev), false)
  })
  it('rejects localhost when there is no dev server', () => assert.equal(isInternalUrl('http://localhost:5173/', { indexFile }), false))
  it('accepts only the renderer index file', () => {
    assert.equal(isInternalUrl(`${pathToFileURL(indexFile)}?thread=2`, { indexFile }), true)
    assert.equal(isInternalUrl(pathToFileURL(path.resolve('/etc/passwd')).toString(), { indexFile }), false)
    assert.equal(isInternalUrl(pathToFileURL(path.join(path.dirname(indexFile), 'other.html')).toString(), { indexFile }), false)
  })
  it('rejects garbage', () => assert.equal(isInternalUrl('not a url', dev), false))
})
