/**
 * IDs of the test portal records the integration tests rely on.
 *
 * Defaults are the upstream (bitrix24/b24jssdk) portal's IDs. On another portal set
 * `B24_TEST_IDS` — a JSON object with the same keys (partial is fine: missing keys
 * fall back to the defaults). The playground command that finds or creates the
 * records prints it:
 *
 *   pnpm --filter @bitrix24/b24jssdk-cli dev make test-fixtures
 */
export const DEFAULT_TEST_IDS = {
  taskSuccess: 2,
  taskFail: -1,
  taskWrong: 3,
  crmDealSuccessMin: 2,
  crmDealSuccessMax: 2,
  crmContactSuccessMin: 2,
  crmContactSuccessMax: 12,
  crmCompanySuccessMin: 2,
  crmCompanySuccessMax: 12,
  crmCompanyFail: -1,
  crmCompanyWrong: 3,
  // @memo get from `main.eventlog.list`
  eventLogMessageSuccessV1: 361,
  eventLogMessageSuccessV2: 359,
  // @memo this wrong value @see test/integration/core/callBatch-v3.spec.ts:483
  messageSuccessV1: 1,
  messageSuccessV2: 2
}

export type TestIds = typeof DEFAULT_TEST_IDS

/**
 * Parses `B24_TEST_IDS`. Empty means the defaults. Invalid JSON, an unknown key or a
 * non-integer value throws: silently falling back to foreign IDs would turn one clear
 * failure into dozens of puzzling ones.
 */
export function parseTestIds(raw: string | undefined): TestIds {
  if (raw === undefined || raw.trim() === '') {
    return { ...DEFAULT_TEST_IDS }
  }

  let parsed: unknown
  try {
    parsed = JSON.parse(raw)
  } catch {
    throw new Error('B24_TEST_IDS: not valid JSON')
  }
  if (parsed === null || typeof parsed !== 'object' || Array.isArray(parsed)) {
    throw new Error('B24_TEST_IDS: expected a JSON object')
  }

  const result: TestIds = { ...DEFAULT_TEST_IDS }
  for (const [key, value] of Object.entries(parsed)) {
    if (!Object.hasOwn(DEFAULT_TEST_IDS, key)) {
      throw new Error(`B24_TEST_IDS: unknown key "${key}"`)
    }
    if (typeof value !== 'number' || !Number.isSafeInteger(value)) {
      throw new TypeError(`B24_TEST_IDS: "${key}" must be an integer`)
    }
    result[key as keyof TestIds] = value
  }
  return result
}
