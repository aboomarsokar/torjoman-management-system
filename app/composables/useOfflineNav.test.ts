import { describe, expect, it } from 'vitest'
import { linkPath, OFFLINE_NAV_MESSAGE, offlineNavMessage, worksOffline } from './useOfflineNav'

describe('worksOffline', () => {
  it('شاشاتُ المعلّم المخزَّنة وحدها، ولو بشهرٍ في الرابط', () => {
    expect(worksOffline('/t/home')).toBe(true)
    expect(worksOffline('/t/quran?y=2026&m=10')).toBe(true)
    expect(worksOffline('/students')).toBe(false)
    expect(worksOffline(undefined)).toBe(false)
  })
  it('رابطُ /exams يعمل للمختبِر بلا اتصال ويُعتَم للمعلّم', () => {
    expect(worksOffline('/exams', 'examiner')).toBe(true)
    expect(worksOffline('/exams?x=1', 'examiner')).toBe(true)
    expect(worksOffline('/exams', 'teacher')).toBe(false)
    expect(worksOffline('/t/home', 'field_supervisor')).toBe(false)
  })
  it('المسارُ بلا استعلام', () => {
    expect(linkPath('/incentives?tab=a#x')).toBe('/incentives')
  })
})

describe('offlineNavMessage', () => {
  it('للمعلّم ولمن لا دورَ له النصُّ القائم حرفياً', () => {
    expect(offlineNavMessage('teacher')).toBe(OFFLINE_NAV_MESSAGE)
    expect(offlineNavMessage(null)).toBe(OFFLINE_NAV_MESSAGE)
    expect(OFFLINE_NAV_MESSAGE).toBe('هذه الشاشة تحتاج اتصالاً — بلا إنترنت تعمل لوحةُ التحكم والحضورُ اليوميّ والإنجازُ القرآنيّ.')
  })
  it('للمشرف الميدانيّ والمختبِر شاشتاهما', () => {
    expect(offlineNavMessage('field_supervisor')).toBe('هذه الشاشة تحتاج اتصالاً — بلا إنترنت تعمل الزياراتُ وملفُّك الشخصيّ.')
    expect(offlineNavMessage('examiner')).toBe('هذه الشاشة تحتاج اتصالاً — بلا إنترنت تعمل الاختباراتُ وملفُّك الشخصيّ.')
  })
})
