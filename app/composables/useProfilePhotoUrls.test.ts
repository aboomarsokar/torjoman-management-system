/**
 * توقيعُ الروابط الناقصة — دفعةٌ واحدة، والمخبّأُ لا يُطلب، والفشلُ صامتٌ يُبقي القديم.
 * يُختبر `signMissing` النقيّ؛ والمركّبُ غلافٌ رقيقٌ عليه بـ`useState`.
 */
import { describe, expect, it, vi } from 'vitest'
import { signMissing, type SignBatchResult } from './useProfilePhotoUrls'
import type { SignedCache } from '~/utils/signedUrlCache'

const NOW = 1_000_000

describe('signMissing', () => {
  it('يوقّع الناقصَ وحدَه في طلبٍ واحد ويحفظه لساعة', async () => {
    const cache: SignedCache = { 'a/photo.webp': { url: 'old', expiresAt: NOW + 600_000 } }
    const sign = vi.fn(async (paths: string[]): Promise<SignBatchResult> => ({
      data: paths.map(path => ({ path, signedUrl: `signed:${path}`, error: null })),
      error: null
    }))

    const next = await signMissing(sign, cache, ['a/photo.webp', 'b/photo.webp', 'b/photo.webp', null], NOW)

    expect(sign).toHaveBeenCalledTimes(1)
    expect(sign).toHaveBeenCalledWith(['b/photo.webp'])
    expect(next['b/photo.webp']).toEqual({ url: 'signed:b/photo.webp', expiresAt: NOW + 3_600_000 })
    expect(next['a/photo.webp']?.url).toBe('old')
  })

  it('ولا يطلب شيئاً إن كان كلُّ شيءٍ مخبّأً — ويُرجع المرجعَ نفسَه', async () => {
    const cache: SignedCache = { 'a/photo.webp': { url: 'u', expiresAt: NOW + 600_000 } }
    const sign = vi.fn()

    expect(await signMissing(sign, cache, ['a/photo.webp'], NOW)).toBe(cache)
    expect(sign).not.toHaveBeenCalled()
  })

  it('رفضُ السياسة يُبقي المخبأ كما هو — والعرضُ الحرفُ الأول', async () => {
    const cache: SignedCache = {}
    const next = await signMissing(async () => ({ data: null, error: { message: 'denied' } }), cache, ['x/photo.webp'], NOW)

    expect(next).toBe(cache)
  })

  it('وانقطاعُ الشبكة المرميّ يُبتلَع كذلك', async () => {
    const cache: SignedCache = {}
    const next = await signMissing(async () => {
      throw new Error('Failed to fetch')
    }, cache, ['x/photo.webp'], NOW)

    expect(next).toBe(cache)
  })
})
