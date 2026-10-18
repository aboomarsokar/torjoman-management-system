/**
 * صورةُ صاحب الحساب — `refreshMyPhoto` بعد الرفع **تُبطل الرابطَ القديم ثم تعيد القراءة**
 * ثم توقّع الجديد، وإلا بقي الوجهُ القديم (منقولٌ من حالات الصحابة في useMyPhoto.test.ts).
 * والمسارُ المعروض نفسُه (`displayPhotoPath`) مختبَرٌ في constants/profilePhoto.test.ts.
 */
import { describe, expect, it, vi } from 'vitest'
import { refreshMyPhoto } from './useMyPhoto'

function steps(initial: string | null, afterReload: string | null) {
  let current = initial
  const order: string[] = []
  return {
    order,
    invalidate: vi.fn((p: string) => {
      order.push(`invalidate:${p}`)
    }),
    reloadProfile: vi.fn(async () => {
      order.push('reload')
      current = afterReload
    }),
    prime: vi.fn(async (paths: (string | null)[]) => {
      order.push(`prime:${paths.join(',')}`)
    }),
    currentPath: () => current
  }
}

describe('refreshMyPhoto', () => {
  it('يُبطل القديمَ ثم يعيد القراءة ثم يوقّع الجديد — بهذا الترتيب', async () => {
    const s = steps('u1/photo.webp', 'u1/photo.webp')

    await refreshMyPhoto(s)

    expect(s.order).toEqual(['invalidate:u1/photo.webp', 'reload', 'prime:u1/photo.webp'])
  })

  it('وبلا صورةٍ سابقة لا يُبطل شيئاً ويقرأ ويوقّع', async () => {
    const s = steps(null, 'u1/photo.webp')

    await refreshMyPhoto(s)

    expect(s.invalidate).not.toHaveBeenCalled()
    expect(s.order).toEqual(['reload', 'prime:u1/photo.webp'])
  })

  it('وبعد الإزالة يُبطل القديمَ ولا يبقى ما يُوقَّع', async () => {
    const s = steps('u1/photo.webp', null)

    await refreshMyPhoto(s)

    expect(s.invalidate).toHaveBeenCalledWith('u1/photo.webp')
    expect(s.prime).toHaveBeenCalledWith([null])
  })
})
