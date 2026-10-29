import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { PROFILE_CACHE_KEY } from './offlineCache'
import { setImpersonatingNow } from './impersonation'
import { formatSavedAt, offlineOwnerRole, offlineOwnerUid, offlineTeacherUid, snapshotKey } from './offlineSnapshot'

/** ملفٌّ محفوظٌ على الجهاز كما يكتبه `useProfile` — يُقرأ عبر `readCache` من التخزين المحلّيّ. */
function stubProfile(profile: { id?: string, role?: string } | null) {
  vi.stubGlobal('localStorage', {
    getItem: (key: string) => (key === PROFILE_CACHE_KEY && profile ? JSON.stringify(profile) : null)
  })
}

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

describe('صاحبُ الجهاز', () => {
  beforeEach(() => stubProfile(null))
  afterEach(() => {
    setImpersonatingNow(false)
    vi.unstubAllGlobals()
  })

  it('offlineOwnerUid يردّ المعرّف للمشرف الميدانيّ والمختبِر', () => {
    stubProfile({ id: 'u1', role: 'field_supervisor' })
    expect(offlineOwnerUid()).toBe('u1')
    stubProfile({ id: 'u1', role: 'examiner' })
    expect(offlineOwnerUid()).toBe('u1')
  })

  it('offlineOwnerUid يردّ null للمدير الإداري والفنيّ', () => {
    stubProfile({ id: 'u1', role: 'admin_manager' })
    expect(offlineOwnerUid()).toBeNull()
    stubProfile({ id: 'u1', role: 'technical_manager' })
    expect(offlineOwnerUid()).toBeNull()
  })

  it('أثناء النيابة لا صاحبَ للمشرف والمختبِر ويبقى للمعلّم', () => {
    setImpersonatingNow(true)
    stubProfile({ id: 'u1', role: 'field_supervisor' })
    expect(offlineOwnerUid()).toBeNull()
    stubProfile({ id: 'u1', role: 'examiner' })
    expect(offlineOwnerUid()).toBeNull()
    stubProfile({ id: 'u1', role: 'teacher' })
    expect(offlineOwnerUid()).toBe('u1')
  })

  it('offlineTeacherUid لا يتغيّر', () => {
    stubProfile({ id: 'u1', role: 'field_supervisor' })
    expect(offlineTeacherUid()).toBeNull()
  })

  it('offlineOwnerRole', () => {
    stubProfile({ id: 'u1', role: 'examiner' })
    expect(offlineOwnerRole()).toBe('examiner')
    stubProfile({ id: 'u1', role: 'admin_manager' })
    expect(offlineOwnerRole()).toBeNull()
    stubProfile(null)
    expect(offlineOwnerRole()).toBeNull()
  })
})
