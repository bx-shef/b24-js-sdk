/**
 * Блоки `::rest-api-version-only` в raw-markdown: слоты `#rest-api-ver2/3`
 * превращаются в пометки `**REST API v2/v3**`, а не в сырой тег и `#undefined`.
 * Чистая функция, без Nuxt — jsSdk:unit.
 */
import { describe, it, expect } from 'vitest'
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { flattenRestApiVersionChildren } from '../../../docs/server/utils/restApiVersionBlocks'

const collect = (nodes: any[]) => nodes.filter(n => Array.isArray(n))

describe('flattenRestApiVersionChildren', () => {
  it('ставит пометки v2 и v3 перед содержимым слотов', () => {
    const out = flattenRestApiVersionChildren([
      ['template', { 'v-slot:rest-api-ver2': '' }, ['p', {}, 'two']],
      ['template', { 'v-slot:rest-api-ver3': '' }, ['p', {}, 'three']]
    ], collect)
    expect(out).toEqual([
      ['p', {}, ['strong', {}, 'REST API v2']],
      ['p', {}, 'two'],
      ['p', {}, ['strong', {}, 'REST API v3']],
      ['p', {}, 'three']
    ])
  })

  it('слот одной версии даёт одну пометку, чужие шаблоны пропускаются', () => {
    const out = flattenRestApiVersionChildren([
      ['template', { 'v-slot:other': '' }, ['p', {}, 'x']],
      ['template', { 'v-slot:rest-api-ver3': '' }, ['p', {}, 'three']]
    ], collect)
    expect(out).toHaveLength(2)
    expect(JSON.stringify(out)).toContain('REST API v3')
    expect(JSON.stringify(out)).not.toContain('REST API v2')
  })
})

describe('transformMDC подключает обработку rest-api-version-only', () => {
  it('visitAndReplace по rest-api-version-only есть в transformMDC.ts', () => {
    const src = readFileSync(resolve(__dirname, '../../../docs/server/utils/transformMDC.ts'), 'utf8')
    expect(src).toContain('\'rest-api-version-only\'')
    expect(src).toContain('flattenRestApiVersionChildren')
  })
})
