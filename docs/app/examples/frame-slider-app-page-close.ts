import { initializeB24Frame } from '@bxshefby/b24jssdk'

export async function Action_frameSliderAppPageClose() {
  // region: start ////
  const $b24 = await initializeB24Frame()

  function closePage() {
    // Never settles; the portal's close button is safer (#486)
    $b24.slider.closeSliderAppPage().catch(() => {})
  }

  closePage()
  // endregion: start ////
}
