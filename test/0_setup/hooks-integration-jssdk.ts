import { beforeAll, afterAll } from 'vitest'
import { setupTestGlobals, getB24Client, getB24Frame } from './setup-integration-jssdk'
import { parseTestIds } from './test-ids'

/**
 * Hooks for integration tests with Bitrix24
 */
export const useB24TestHooks = () => {
  beforeAll(() => {
    // console.log('🚀 Setting up B24 integration tests...')
    setupTestGlobals()
  })

  afterAll(() => {
    const b24 = getB24Client()
    b24.destroy()
  })

  function getMapId(): Record<string, number> {
    return parseTestIds(process.env.B24_TEST_IDS)
  }

  return {
    getB24Client,
    getB24Frame,
    getMapId
  }
}

/**
 * Short alias for using hooks
 */
export const setupB24Tests = useB24TestHooks
