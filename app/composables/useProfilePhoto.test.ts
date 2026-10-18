/**
 * ترتيبُ خطوات الرفع والإزالة — يُختبر بواجهةٍ مزيَّفة تسجّل ما طُلب منها.
 * الرفعُ قبل تثبيت المسار، والإزالةُ تُفرِّغ المسار قبل حذف الملفّ، وصفرُ الصفوف رفضٌ بالعربية.
 */
import { describe, expect, it } from 'vitest'
import {
  PHOTO_FILE_LEFT, PHOTO_REMOVE_DENIED, PHOTO_SAVE_DENIED, PHOTO_TOO_LARGE,
  PhotoFileLeftError, removeProfilePhoto, uploadProfilePhoto, type PhotoBackend
} from './useProfilePhoto'

interface FakeOptions {
  uploadError?: unknown
  rows?: { id: string }[] | null
  removeThrows?: boolean
  removeError?: unknown
}

function fakeBackend(options: FakeOptions = {}) {
  const calls: string[] = []
  const backend: PhotoBackend = {
    async uploadObject(path) {
      calls.push(`upload:${path}`)
      return { error: options.uploadError ?? null }
    },
    async removeObject(path) {
      calls.push(`remove:${path}`)
      if (options.removeThrows) throw new Error('Failed to fetch')
      return { error: options.removeError ?? null }
    },
    async setPhotoPath(profileId, path) {
      calls.push(`row:${profileId}=${path}`)
      return { data: options.rows === undefined ? [{ id: profileId }] : options.rows, error: null }
    }
  }
  return { backend, calls }
}

const file = new File(['x'], 'me.jpg', { type: 'image/jpeg' })
const shrinkTo = (size: number) => async () => new Blob([new Uint8Array(size)], { type: 'image/webp' })

describe('uploadProfilePhoto', () => {
  it('يرفع إلى المسار الثابت ثم يثبّته في الصفّ — بهذا الترتيب', async () => {
    const { backend, calls } = fakeBackend()

    const path = await uploadProfilePhoto(backend, 'p1', file, shrinkTo(1000))

    expect(path).toBe('p1/photo.webp')
    expect(calls).toEqual(['upload:p1/photo.webp', 'row:p1=p1/photo.webp'])
  })

  it('ما تجاوز الحدَّ بعد التصغير يُرفض قبل أيّ طلب', async () => {
    const { backend, calls } = fakeBackend()

    await expect(uploadProfilePhoto(backend, 'p1', file, shrinkTo(256 * 1024 + 1))).rejects.toThrow(PHOTO_TOO_LARGE)
    expect(calls).toEqual([])
  })

  it('فشلُ الرفع لا يمسّ الصفّ — فلا يُشير إلى ملفٍّ لا وجود له', async () => {
    const { backend, calls } = fakeBackend({ uploadError: { message: 'new row violates row-level security policy' } })

    await expect(uploadProfilePhoto(backend, 'p1', file, shrinkTo(10))).rejects.toMatchObject({ message: expect.stringContaining('row-level') })
    expect(calls).toEqual(['upload:p1/photo.webp'])
  })

  it('صفرُ صفوفٍ (رفض RLS الصامت) يُرمى برسالةٍ عربية', async () => {
    const { backend } = fakeBackend({ rows: [] })

    await expect(uploadProfilePhoto(backend, 'p1', file, shrinkTo(10))).rejects.toThrow(PHOTO_SAVE_DENIED)
  })
})

describe('removeProfilePhoto', () => {
  it('يُفرِّغ المسار أوّلاً ثم يحذف الملفّ', async () => {
    const { backend, calls } = fakeBackend()

    await removeProfilePhoto(backend, 'p1')

    expect(calls).toEqual(['row:p1=null', 'remove:p1/photo.webp'])
  })

  it('وخطأُ المستودع المُعاد من الحذف لا يُبتلع — يُرمى بالعربية بعد إفراغ المسار', async () => {
    const { backend, calls } = fakeBackend({ removeError: { message: 'Object not found' } })

    const failure = removeProfilePhoto(backend, 'p1')
    await expect(failure).rejects.toBeInstanceOf(PhotoFileLeftError)
    await expect(failure).rejects.toThrow(PHOTO_FILE_LEFT)
    expect(calls).toEqual(['row:p1=null', 'remove:p1/photo.webp'])
  })

  it('وكذلك الانقطاعُ المرميّ أثناء الحذف', async () => {
    const { backend } = fakeBackend({ removeThrows: true })

    await expect(removeProfilePhoto(backend, 'p1')).rejects.toBeInstanceOf(PhotoFileLeftError)
  })

  it('وصفرُ الصفوف يُرمى بالعربية ولا يُحذف الملفّ', async () => {
    const { backend, calls } = fakeBackend({ rows: [] })

    await expect(removeProfilePhoto(backend, 'p1')).rejects.toThrow(PHOTO_REMOVE_DENIED)
    expect(calls).toEqual(['row:p1=null'])
  })
})
