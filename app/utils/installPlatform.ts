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

/**
 * يُعرض زرُّ التثبيت؟ (المستخدم 2026-10-24: «يظلّ ظاهراً مع أني منزّلُ التطبيق».) الموقعُ في تبويب المتصفّح لا يعرف
 * أنّ تطبيقه مثبَّت — إلا أنّ متصفّحات Chromium (Chrome وEdge وSamsung) لا تُطلق `beforeinstallprompt` لتطبيقٍ مثبَّت:
 * فيها يُعرض الزرُّ بوصول الحدث وحدَه. وحيث لا حدثَ أصلاً (iPhone وSafari الماك وFirefox أندرويد) لا سبيلَ للعلم،
 * فيبقى الزرُّ بخطواته. والحاسوبُ بلا حدثٍ لا يُثبِّت (Firefox الحاسوب) فلا زرّ.
 */
export function showInstallButton(platform: InstallPlatform, ua: string, canPrompt: boolean): boolean {
  if (canPrompt) return true
  if (platform === 'ios-safari' || platform === 'ios-other' || platform === 'mac-safari') return true
  const chromium = /chrome|chromium|edg\/|samsungbrowser/i.test(ua) && !/firefox/i.test(ua)
  return platform === 'android' && !chromium
}
