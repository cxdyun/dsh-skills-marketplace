import assert from 'node:assert/strict'
import test from 'node:test'
import { sameOrigin } from '../lib/http.js'

const request = (headers) => ({ headers })

test('sameOrigin accepts a desktop same-origin request without Origin', () => {
  assert.equal(sameOrigin(request({ host: 'app', 'sec-fetch-site': 'same-origin' })), true)
  assert.equal(sameOrigin(request({ host: 'app', referer: 'dsh-app://app/settings' })), true)
  assert.equal(sameOrigin(request({ host: 'app', 'x-dsh-skills-marketplace': '1' })), true)
})

test('sameOrigin still rejects cross-origin or unverifiable requests', () => {
  assert.equal(sameOrigin(request({ host: 'app', origin: 'https://evil.example', 'sec-fetch-site': 'same-origin' })), false)
  assert.equal(sameOrigin(request({ host: 'app', 'sec-fetch-site': 'cross-site', 'x-dsh-skills-marketplace': '1' })), false)
  assert.equal(sameOrigin(request({ host: 'app', referer: 'https://evil.example/', 'x-dsh-skills-marketplace': '1' })), false)
  assert.equal(sameOrigin(request({ host: 'app', referer: 'https://evil.example/' })), false)
  assert.equal(sameOrigin(request({ host: 'app' })), false)
})
