// منقولٌ من الصحابة (app/utils/signedUrlCache.test.ts) كما هو.
import { describe, expect, it } from 'vitest'
import { pathsToSign, storeSigned, urlFrom, withoutPath, type SignedCache } from './signedUrlCache'

const NOW = 1_000_000

describe('ما يُوقَّع', () => {
  it('الفارغُ والمكرَّر يُسقَطان، والمخبّأُ الصالح لا يُطلب ثانيةً', () => {
    const cache: SignedCache = { 'a/photo.webp': { url: 'u', expiresAt: NOW + 600_000 } }

    expect(pathsToSign(cache, ['a/photo.webp', null, 'b/photo.webp', 'b/photo.webp', undefined], NOW))
      .toEqual(['b/photo.webp'])
  })

  it('والذي يوشك على الانتهاء يُطلب من جديد — لا صورةٌ تنكسر وسط الشاشة', () => {
    const cache: SignedCache = { 'a/photo.webp': { url: 'u', expiresAt: NOW + 30_000 } }

    expect(pathsToSign(cache, ['a/photo.webp'], NOW)).toEqual(['a/photo.webp'])
  })
})

describe('التخزين', () => {
  it('يحفظ الناجحَ ويتجاهل ما ردّه المستودع', () => {
    const next = storeSigned({}, [
      { path: 'a/photo.webp', signedUrl: 'https://x/a?token=1', error: null },
      { path: 'b/photo.webp', signedUrl: '', error: 'Object not found' }
    ], NOW, 3600)

    expect(urlFrom(next, 'a/photo.webp', NOW)).toBe('https://x/a?token=1')
    expect(urlFrom(next, 'b/photo.webp', NOW)).toBeNull()
    expect(next['a/photo.webp']?.expiresAt).toBe(NOW + 3_600_000)
  })

  it('ولا يُعدّل المخبأَ القديم في مكانه — الاستجابةُ تُبنى على مرجعٍ جديد', () => {
    const before: SignedCache = {}
    const after = storeSigned(before, [{ path: 'a/photo.webp', signedUrl: 'u', error: null }], NOW, 60)

    expect(before).toEqual({})
    expect(after).not.toBe(before)
  })
})

describe('القراءة والإبطال', () => {
  it('المنتهي يُقرأ فارغاً — فيسقط العرضُ إلى الحرف لا إلى مربّعٍ مكسور', () => {
    const cache: SignedCache = { 'a/photo.webp': { url: 'u', expiresAt: NOW - 1 } }

    expect(urlFrom(cache, 'a/photo.webp', NOW)).toBeNull()
    expect(urlFrom(cache, null, NOW)).toBeNull()
  })

  it('والإبطالُ بعد الرفع يُسقط المسارَ وحدَه ولا يمسّ الأصل', () => {
    const cache: SignedCache = {
      'a/photo.webp': { url: 'u', expiresAt: NOW + 1 },
      'b/photo.webp': { url: 'v', expiresAt: NOW + 1 }
    }

    expect(Object.keys(withoutPath(cache, 'a/photo.webp'))).toEqual(['b/photo.webp'])
    expect(Object.keys(cache)).toEqual(['a/photo.webp', 'b/photo.webp'])
  })
})
