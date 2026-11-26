#!/usr/bin/env node
// Fixture tests for scripts/check-docs-csp-present.mjs.
//
// The script asserts every built HTML page carries the CSP <meta>. The one
// exception is the static wrapper of the CRM form (`b24-form.html`): it is not a
// Nuxt page, must load the Bitrix24 loader and is deliberately outside the policy.
// The exception must be narrow — only that file, only while it stays `noindex`.
//
// Run with: node --test scripts/__tests__/check-docs-csp-present.test.mjs

import { mkdtempSync, mkdirSync, writeFileSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join, resolve, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'
import { spawnSync } from 'node:child_process'
import test from 'node:test'
import assert from 'node:assert/strict'

const SCRIPT = resolve(dirname(fileURLToPath(import.meta.url)), '..', 'check-docs-csp-present.mjs')

const POLICY = `default-src 'self'; script-src 'self'; object-src 'none'; base-uri 'self'; frame-src 'self'`
const page = `<!doctype html><html><head><meta http-equiv="Content-Security-Policy" content="${POLICY}"><title>x</title></head><body></body></html>`
const noCsp = `<!doctype html><html><head><title>x</title></head><body></body></html>`
const wrapper = `<!doctype html><html><head><meta name="robots" content="noindex, nofollow"></head><body></body></html>`

function run(files) {
  const root = mkdtempSync(join(tmpdir(), 'csp-present-'))
  try {
    for (const [name, html] of Object.entries(files)) {
      mkdirSync(dirname(join(root, name)), { recursive: true })
      writeFileSync(join(root, name), html)
    }
    const r = spawnSync(process.execPath, [SCRIPT], {
      env: { ...process.env, DOCS_CSP_ROOT: root },
      encoding: 'utf8'
    })
    return { code: r.status, out: r.stdout + r.stderr }
  } finally {
    rmSync(root, { recursive: true, force: true })
  }
}

test('a page with the policy passes', () => {
  assert.equal(run({ 'index.html': page }).code, 0)
})

test('a Nuxt page without the policy fails', () => {
  const r = run({ 'index.html': page, 'other.html': noCsp })
  assert.notEqual(r.code, 0)
  assert.match(r.out, /no Content-Security-Policy meta tag/)
})

test('the noindex form wrapper is exempt', () => {
  assert.equal(run({ 'index.html': page, 'b24-form.html': wrapper }).code, 0)
})

test('the exemption needs noindex', () => {
  const r = run({ 'index.html': page, 'b24-form.html': noCsp })
  assert.notEqual(r.code, 0)
  assert.match(r.out, /noindex/)
})

test('the exemption is only for that file', () => {
  const r = run({ 'index.html': page, 'other.html': wrapper })
  assert.notEqual(r.code, 0)
})

test('noindex inside an HTML comment does not count', () => {
  const commented = '<!doctype html><html><head><!-- <meta name="robots" content="noindex"> --><title>x</title></head><body></body></html>'
  const r = run({ 'index.html': page, 'b24-form.html': commented })
  assert.notEqual(r.code, 0)
})
