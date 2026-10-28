import { describe, expect, it } from 'vitest'
import { dayLabel, isOnline, membersLabel, lastSeenLabel, listTime, messageTime, readByOthers, startsNewDay } from './chat'

// 2026-10-27 12:00 بتوقيت غزة (+02)
const NOW = Date.parse('2026-10-27T10:00:00Z')

describe('isOnline / lastSeenLabel', () => {
  it('متصلٌ في الدقيقتين الأخيرتين', () => {
    expect(isOnline('2026-10-27T09:59:00Z', NOW)).toBe(true)
    expect(lastSeenLabel('2026-10-27T09:59:00Z', NOW)).toBe('متصل الآن')
  })
  it('آخرُ ظهورٍ اليوم وأمس', () => {
    expect(isOnline('2026-10-27T09:00:00Z', NOW)).toBe(false)
    expect(lastSeenLabel('2026-10-27T07:15:00Z', NOW)).toBe('آخر ظهور: اليوم 9:15 ص')
    expect(lastSeenLabel('2026-10-26T19:40:00Z', NOW)).toBe('آخر ظهور: أمس 9:40 م')
  })
  it('لم يظهر بعد', () => {
    expect(lastSeenLabel(null, NOW)).toBe('لم يظهر بعد')
  })
})

describe('dayLabel / listTime / messageTime', () => {
  it('يومُ غزة لا يومُ UTC', () => {
    // 23:30 UTC يوم 26 = 1:30 ص يوم 27 بغزة
    expect(dayLabel('2026-10-26T23:30:00Z', NOW)).toBe('اليوم')
    expect(dayLabel('2026-10-20T10:00:00Z', NOW)).toBe('20/10/2026')
  })
  it('الساعةُ لليوم، وإلا اليوم', () => {
    expect(listTime('2026-10-27T08:05:00Z', NOW)).toBe('10:05 ص')
    expect(listTime('2026-10-26T08:05:00Z', NOW)).toBe('أمس')
    expect(listTime(null, NOW)).toBe('')
    expect(messageTime('2026-10-27T12:30:00Z')).toBe('2:30 م')
  })
})

describe('readByOthers / startsNewDay', () => {
  const members = [{ id: 'me', last_read_at: '2026-10-27T09:00:00Z' }, { id: 'a', last_read_at: '2026-10-27T09:30:00Z' }]
  it('قرأها الطرفُ الآخر أو لم يقرأها', () => {
    expect(readByOthers('2026-10-27T09:10:00Z', members, 'me')).toBe(true)
    expect(readByOthers('2026-10-27T09:40:00Z', members, 'me')).toBe(false)
    expect(readByOthers('2026-10-27T09:10:00Z', [{ id: 'me', last_read_at: null }], 'me')).toBe(false)
  })
  it('فاصلُ اليوم', () => {
    expect(startsNewDay(undefined, '2026-10-27T09:00:00Z')).toBe(true)
    expect(startsNewDay('2026-10-27T08:00:00Z', '2026-10-27T09:00:00Z')).toBe(false)
    expect(startsNewDay('2026-10-26T22:30:00Z', '2026-10-27T09:00:00Z')).toBe(false)
    expect(startsNewDay('2026-10-26T12:00:00Z', '2026-10-27T09:00:00Z')).toBe(true)
  })
})

describe('membersLabel', () => {
  it('جمعُ العدد', () => {
    expect(membersLabel(2)).toBe('عضوان')
    expect(membersLabel(4)).toBe('4 أعضاء')
    expect(membersLabel(24)).toBe('24 عضواً')
  })
})
