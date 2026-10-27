import { afterEach, describe, expect, it, vi } from 'vitest'
import { clearOfflineCaches, PROFILE_CACHE_KEY, readCache, TEACHER_DASH_CACHE_KEY, writeCache } from './offlineCache'

function fakeStorage() {
  const map = new Map<string, string>()
  return {
    getItem: (k: string) => map.get(k) ?? null,
    setItem: (k: string, v: string) => void map.set(k, v),
    removeItem: (k: string) => void map.delete(k)
  }
}

afterEach(() => vi.unstubAllGlobals())

describe('offlineCache', () => {
  it('يكتب ويقرأ ويمحو عند الخروج', () => {
    vi.stubGlobal('localStorage', fakeStorage())
    writeCache(PROFILE_CACHE_KEY, { id: 'u', role: 'teacher' })
    writeCache(TEACHER_DASH_CACHE_KEY, { uid: 'u' })
    expect(readCache(PROFILE_CACHE_KEY)).toEqual({ id: 'u', role: 'teacher' })
    clearOfflineCaches()
    expect(readCache(PROFILE_CACHE_KEY)).toBeNull()
    // لوحةُ المعلّم لا يراها مستخدمٌ تالٍ على الجهاز
    expect(readCache(TEACHER_DASH_CACHE_KEY)).toBeNull()
  })

  it('التخزينُ المحجوب لا يرمي', () => {
    const blocked = () => {
      throw new Error('blocked')
    }
    vi.stubGlobal('localStorage', { getItem: blocked, setItem: blocked, removeItem: blocked })
    expect(readCache(PROFILE_CACHE_KEY)).toBeNull()
    expect(() => writeCache(PROFILE_CACHE_KEY, {})).not.toThrow()
    expect(() => clearOfflineCaches()).not.toThrow()
  })
})
