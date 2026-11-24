#!/usr/bin/env node
// Anchors in scripts/docs-link-check.mjs must match the ids the site renders
// (github-slugger via @nuxtjs/mdc) — for Russian headings too.
//
// Run with: node --test scripts/__tests__/docs-link-check-slug.test.mjs

import { test } from 'node:test'
import assert from 'node:assert/strict'
import { slugifyHeading } from '../docs-link-check.mjs'

test('ASCII headings keep the existing slugs', () => {
  assert.equal(slugifyHeading('Init'), 'init')
  assert.equal(slugifyHeading('Runtime: Node 20 was dropped in 3.0.0'), 'runtime-node-20-was-dropped-in-300')
  assert.equal(slugifyHeading('call_list & batch'), 'call_list--batch')
})

test('Cyrillic headings keep their letters, as github-slugger does', () => {
  assert.equal(slugifyHeading('Инициализация'), 'инициализация')
  assert.equal(slugifyHeading('Как использовать: шаг 1'), 'как-использовать-шаг-1')
  assert.equal(slugifyHeading('Ёжик и «кавычки»'), 'ёжик-и-кавычки')
})
