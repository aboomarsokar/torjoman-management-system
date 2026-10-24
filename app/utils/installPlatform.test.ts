import { describe, expect, it } from 'vitest'
import { installPlatform, showInstallButton } from './installPlatform'

const IPHONE_SAFARI = 'Mozilla/5.0 (iPhone; CPU iPhone OS 17_5 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.5 Mobile/15E148 Safari/604.1'
const IPHONE_CHROME = 'Mozilla/5.0 (iPhone; CPU iPhone OS 17_5 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) CriOS/126.0 Mobile/15E148 Safari/604.1'
const IPAD_AS_MAC = 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.5 Safari/605.1.15'
const MAC_CHROME = 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0 Safari/537.36'
const ANDROID_CHROME = 'Mozilla/5.0 (Linux; Android 14; SM-A145F) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0 Mobile Safari/537.36'
const WINDOWS_EDGE = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0 Safari/537.36 Edg/126.0'

describe('installPlatform', () => {
  it('يميّز Safari الآيفون عن متصفّحاته الأخرى', () => {
    expect(installPlatform(IPHONE_SAFARI)).toBe('ios-safari')
    expect(installPlatform(IPHONE_CHROME)).toBe('ios-other')
  })
  it('يعرف الآيباد المتنكّرَ ماكاً بنقاط اللمس، والماكَ الحقيقيّ بلا لمس', () => {
    expect(installPlatform(IPAD_AS_MAC, 'MacIntel', 5)).toBe('ios-safari')
    expect(installPlatform(IPAD_AS_MAC, 'MacIntel', 0)).toBe('mac-safari')
  })
  it('أندرويد، والحاسوبُ بمتصفّحات Chromium', () => {
    expect(installPlatform(ANDROID_CHROME)).toBe('android')
    expect(installPlatform(MAC_CHROME, 'MacIntel', 0)).toBe('desktop')
    expect(installPlatform(WINDOWS_EDGE, 'Win32')).toBe('desktop')
  })
})

const ANDROID_FIREFOX = 'Mozilla/5.0 (Android 14; Mobile; rv:131.0) Gecko/131.0 Firefox/131.0'
const ANDROID_SAMSUNG = 'Mozilla/5.0 (Linux; Android 14; SM-A145F) AppleWebKit/537.36 (KHTML, like Gecko) SamsungBrowser/26.0 Chrome/122.0 Mobile Safari/537.36'

describe('showInstallButton', () => {
  it('Chromium بلا حدثٍ = مثبَّتٌ غالباً، فلا زرّ؛ وبالحدث يظهر', () => {
    expect(showInstallButton('android', ANDROID_CHROME, false)).toBe(false)
    expect(showInstallButton('android', ANDROID_SAMSUNG, false)).toBe(false)
    expect(showInstallButton('desktop', WINDOWS_EDGE, false)).toBe(false)
    expect(showInstallButton('android', ANDROID_CHROME, true)).toBe(true)
    expect(showInstallButton('desktop', MAC_CHROME, true)).toBe(true)
  })
  it('حيث لا حدثَ أصلاً يبقى الزرُّ بخطواته', () => {
    expect(showInstallButton('ios-safari', IPHONE_SAFARI, false)).toBe(true)
    expect(showInstallButton('ios-other', IPHONE_CHROME, false)).toBe(true)
    expect(showInstallButton('mac-safari', IPAD_AS_MAC, false)).toBe(true)
    expect(showInstallButton('android', ANDROID_FIREFOX, false)).toBe(true)
  })
})
