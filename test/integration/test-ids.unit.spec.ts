import { describe, it, expect } from 'vitest'
import { parseTestIds, DEFAULT_TEST_IDS } from '../0_setup/test-ids'

describe('B24_TEST_IDS', () => {
  it('empty means the upstream defaults', () => {
    expect(parseTestIds(undefined)).toEqual(DEFAULT_TEST_IDS)
    expect(parseTestIds('  ')).toEqual(DEFAULT_TEST_IDS)
  })

  it('a partial object overrides only its keys', () => {
    const ids = parseTestIds('{"taskSuccess":77,"crmCompanySuccessMax":105}')
    expect(ids.taskSuccess).toBe(77)
    expect(ids.crmCompanySuccessMax).toBe(105)
    expect(ids.crmDealSuccessMin).toBe(DEFAULT_TEST_IDS.crmDealSuccessMin)
  })

  it('does not mutate the defaults', () => {
    parseTestIds('{"taskSuccess":77}')
    expect(DEFAULT_TEST_IDS.taskSuccess).toBe(2)
  })

  it.each([
    ['not json', /not valid JSON/],
    ['[1,2]', /JSON object/],
    ['null', /JSON object/],
    ['{"taskSucess":1}', /unknown key/],
    ['{"__proto__":1}', /unknown key/],
    ['{"taskSuccess":"5"}', /integer/],
    ['{"taskSuccess":1.5}', /integer/]
  ])('rejects %s', (raw, message) => {
    expect(() => parseTestIds(raw)).toThrow(message)
  })
})
