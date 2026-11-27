import { describe, it, expect } from 'vitest'
import { setupB24Tests } from '../../0_setup/hooks-integration-jssdk'

describe('parentMessage', () => {
  const { getB24Frame } = setupB24Tests()

  // Fork: skipped. The harness cannot run inside a Bitrix24 frame — `getB24Frame()`
  // throws '@todo init B24Frame' — so this test can only fail, in CI and locally.
  // Re-enable when `getB24Frame()` returns a real frame.
  it.skip('FirstTest', async () => {
    const b24 = getB24Frame()

    const method = 'im:setTextareaContent'
    const requestId = `test@coreTools/${method}`
    const response = await b24.parent.message.send(
      method,
      {
        isRawValue: true,
        isSafely: true,
        safelyTime: 500,
        requestId,
        text: 'Text for insertion'
      }
    )

    expect(response).toBeTruthy()
  })
})
