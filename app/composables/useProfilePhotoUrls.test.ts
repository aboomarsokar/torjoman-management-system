/**
 * توقيعُ الروابط الناقصة — دفعةٌ واحدة، والمخبّأُ لا يُطلب، والفشلُ صامت؛ وتداخلُ طلبين
 * لا يمحو أحدُهما الآخر، والإبطالُ أثناء طلبٍ في الطريق لا يُبعث (جولة الإصلاح الأولى).
 */
import { describe, expect, it, vi } from 'vitest'
import { createProfilePhotoUrlStore, signMissing, type SignBatchResult, type ValueBox } from './useProfilePhotoUrls'
import type { SignedCache } from '~/utils/signedUrlCache'

const NOW = 1_000_000

function okSign(paths: string[], tag = 'signed'): SignBatchResult {
  return { data: paths.map(path => ({ path, signedUrl: `${tag}:${path}`, error: null })), error: null }
}

/** موقِّعٌ يُمسك كلَّ طلبٍ حتى يُفرَج عنه يدوياً — لمحاكاة طلبين متداخلين. */
function deferredSigner() {
  const pending: { paths: string[], release: (tag?: string) => void }[] = []
  const sign = (paths: string[]) => new Promise<SignBatchResult>((resolve) => {
    pending.push({ paths, release: (tag = 'signed') => resolve(okSign(paths, tag)) })
  })
  return { sign, pending }
}

function newStore(sign: (paths: string[]) => Promise<SignBatchResult>) {
  const cache: ValueBox<SignedCache> = { value: {} }
  const generations: ValueBox<Record<string, number>> = { value: {} }
  return { cache, store: createProfilePhotoUrlStore(cache, generations, sign, () => NOW) }
}

describe('signMissing', () => {
  it('يوقّع الناقصَ وحدَه في طلبٍ واحد ويُرجع المدخلاتِ الجديدة وحدها', async () => {
    const cache: SignedCache = { 'a/photo.webp': { url: 'old', expiresAt: NOW + 600_000 } }
    const sign = vi.fn(async (paths: string[]) => okSign(paths))

    const entries = await signMissing(sign, cache, ['a/photo.webp', 'b/photo.webp', 'b/photo.webp', null], NOW)

    expect(sign).toHaveBeenCalledTimes(1)
    expect(sign).toHaveBeenCalledWith(['b/photo.webp'])
    expect(entries).toEqual({ 'b/photo.webp': { url: 'signed:b/photo.webp', expiresAt: NOW + 3_600_000 } })
  })

  it('ولا يطلب شيئاً إن كان كلُّ شيءٍ مخبّأً', async () => {
    const cache: SignedCache = { 'a/photo.webp': { url: 'u', expiresAt: NOW + 600_000 } }
    const sign = vi.fn()

    expect(await signMissing(sign, cache, ['a/photo.webp'], NOW)).toEqual({})
    expect(sign).not.toHaveBeenCalled()
  })

  it('رفضُ السياسة وانقطاعُ الشبكة لا يُرجعان شيئاً — والعرضُ الحرفُ الأول', async () => {
    expect(await signMissing(async () => ({ data: null, error: { message: 'denied' } }), {}, ['x/photo.webp'], NOW)).toEqual({})
    expect(await signMissing(async () => {
      throw new Error('Failed to fetch')
    }, {}, ['x/photo.webp'], NOW)).toEqual({})
  })
})

describe('createProfilePhotoUrlStore', () => {
  it('طلبان متداخلان (الشريط وقائمة) لا يمحو المتأخّرُ منهما ما حفظه الأسبق', async () => {
    const { sign, pending } = deferredSigner()
    const { store } = newStore(sign)

    const layout = store.prime(['me/photo.webp'])
    const list = store.prime(['a/photo.webp', 'b/photo.webp'])
    expect(pending).toHaveLength(2)

    pending[1]!.release()
    await list
    pending[0]!.release()
    await layout

    expect(store.urlFor('me/photo.webp')).toBe('signed:me/photo.webp')
    expect(store.urlFor('a/photo.webp')).toBe('signed:a/photo.webp')
    expect(store.urlFor('b/photo.webp')).toBe('signed:b/photo.webp')
  })

  it('الإبطالُ أثناء طلبٍ في الطريق لا يُبعث برابط ما قبل الرفع', async () => {
    const { sign, pending } = deferredSigner()
    const { store } = newStore(sign)

    const inFlight = store.prime(['me/photo.webp'])
    store.invalidate('me/photo.webp') // رفعٌ جديد انتهى قبل أن يعود الطلبُ القديم
    pending[0]!.release('stale')
    await inFlight

    expect(store.urlFor('me/photo.webp')).toBeNull()

    // والتوقيعُ بعد الإبطال يُحفظ عادياً
    const again = store.prime(['me/photo.webp'])
    pending[1]!.release('fresh')
    await again
    expect(store.urlFor('me/photo.webp')).toBe('fresh:me/photo.webp')
  })

  it('والإبطالُ يُسقط المسارَ وحدَه من المخبأ', async () => {
    const { store } = newStore(async paths => okSign(paths))

    await store.prime(['a/photo.webp', 'b/photo.webp'])
    store.invalidate('a/photo.webp')

    expect(store.urlFor('a/photo.webp')).toBeNull()
    expect(store.urlFor('b/photo.webp')).toBe('signed:b/photo.webp')
  })
})
