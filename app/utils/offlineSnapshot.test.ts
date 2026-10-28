import { describe, expect, it } from 'vitest'
import { formatSavedAt, snapshotKey } from './offlineSnapshot'

describe('offlineSnapshot', () => {
  it('مفتاحٌ لكلّ معلّمٍ وشاشة', () => {
    expect(snapshotKey('u', 'visits-list')).toBe('snap|u|visits-list')
  })
  it('وقتُ النسخة بتوقيت غزة', () => {
    // 07:42 بتوقيت غرينتش = 10:42 في غزة (توقيتُ الصيف +3)، و09:42 بعد انتهائه (+2)
    expect(formatSavedAt('2026-10-20T07:42:00Z')).toBe('20-10 · 10:42 ص')
    expect(formatSavedAt('2026-12-01T07:42:00Z')).toBe('01-12 · 9:42 ص')
    // 14:06 بتوقيت غزة (+2 بعد انتهاء الصيفيّ) ← 12 ساعة
    expect(formatSavedAt('2026-10-28T12:06:00Z')).toBe('28-10 · 2:06 م')
    expect(formatSavedAt('2026-10-27T22:30:00Z')).toBe('28-10 · 12:30 ص')
  })
})
