// منقولٌ من الصحابة (app/utils/imageSquare.test.ts) — بفرع الاقتصاص وحدَه.
import { afterEach, describe, expect, it, vi } from 'vitest'
import { coverCrop, shrinkToSquare } from './imageSquare'

describe('ملفٌّ لا يُقرأ صورةً', () => {
  afterEach(() => {
    vi.unstubAllGlobals()
  })

  it('يُرفض برسالةٍ عربية تقول ما يُفعل', async () => {
    vi.stubGlobal('createImageBitmap', () =>
      Promise.reject(new DOMException('The source image could not be decoded.', 'InvalidStateError')))

    const pdf = new File(['%PDF-1.7'], 'cv.pdf', { type: 'application/pdf' })

    await expect(shrinkToSquare(pdf, 256))
      .rejects.toThrow('هذا الملف ليس صورة يمكن قراءتها. اختر صورة PNG أو JPEG أو WebP.')
  })
})

describe('اقتصاصُ الوجه من المركز', () => {
  it('العريضةُ تُقصّ من جانبيها إلى مربّعٍ بارتفاعها', () => {
    expect(coverCrop(1200, 800)).toEqual({ sx: 200, sy: 0, sw: 800, sh: 800 })
  })

  it('والطويلةُ من أعلاها وأسفلها إلى مربّعٍ بعرضها', () => {
    expect(coverCrop(600, 1000)).toEqual({ sx: 0, sy: 200, sw: 600, sh: 600 })
  })

  it('والمربّعةُ كما هي', () => {
    expect(coverCrop(500, 500)).toEqual({ sx: 0, sy: 0, sw: 500, sh: 500 })
  })

  it('وأبعادٌ صفرية لا تُسقط الحساب', () => {
    expect(coverCrop(0, 300)).toEqual({ sx: 0, sy: 0, sw: 0, sh: 0 })
  })
})
