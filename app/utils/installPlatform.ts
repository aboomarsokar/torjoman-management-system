/** الجهازُ والمتصفّح لخطوات تثبيت التطبيق اليدويّ (انظر `usePwaInstall`). */
export type InstallPlatform = 'ios-safari' | 'ios-other' | 'mac-safari' | 'android' | 'desktop'

/**
 * المنصّةُ من وكيل المستخدم — دالّةٌ نقيّة للاختبار. iPadOS يتنكّر ماكاً فيُعرف بنقاط اللمس.
 * Safari وحده يُثبِّت على الماك (17+)، وعلى iPhone يُضاف من قائمة المشاركة.
 */
export function installPlatform(ua: string, platform = '', maxTouchPoints = 0): InstallPlatform {
  const iOS = /iphone|ipad|ipod/i.test(ua) || (platform === 'MacIntel' && maxTouchPoints > 1)
  const safari = /safari/i.test(ua) && !/crios|fxios|edgios|chrome|chromium|edg\//i.test(ua)
  if (iOS) return safari ? 'ios-safari' : 'ios-other'
  if (/android/i.test(ua)) return 'android'
  if (safari && /macintosh|mac os x/i.test(ua)) return 'mac-safari'
  return 'desktop'
}
