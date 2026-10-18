import { describe, expect, it } from 'vitest'
import { canHavePhoto, displayPhotoPath, PHOTO_BUCKET, PHOTO_MAX_BYTES, PHOTO_SIGNED_SECONDS, photoPath } from './profilePhoto'

describe('مسار الصورة الشخصية', () => {
  it('يبدأ بمعرّف الحساب وينتهي باسمٍ ثابت — والقيدُ في القاعدة يفرض هذا الشكلَ بعينه', () => {
    expect(photoPath('abc-123')).toBe('abc-123/photo.webp')
  })

  it('والحدُّ 256 كيلوبايت يطابق file_size_limit في الهجرة', () => {
    expect(PHOTO_MAX_BYTES).toBe(262144)
  })

  it('والمخزنُ خاصٌّ باسمه في الهجرة، والتوقيعُ لساعة', () => {
    expect(PHOTO_BUCKET).toBe('profile-photos')
    expect(PHOTO_SIGNED_SECONDS).toBe(3600)
  })
})

describe('لا صور لقسم البنات (قرار 2026-10-18)', () => {
  it('الأنثى لا صورة لها، والذكرُ والجنسُ الفارغ يجوز — كالقيد في القاعدة', () => {
    expect(canHavePhoto('female')).toBe(false)
    expect(canHavePhoto('male')).toBe(true)
    expect(canHavePhoto(null)).toBe(true)
    expect(canHavePhoto(undefined)).toBe(true)
  })

  it('المسارُ المعروض للأنثى null حتى لو وُجد في الصفّ — فالعرضُ الحرفُ الأول', () => {
    expect(displayPhotoPath({ gender: 'female', photo_path: 'x/photo.webp' })).toBeNull()
    expect(displayPhotoPath({ gender: 'male', photo_path: 'x/photo.webp' })).toBe('x/photo.webp')
    expect(displayPhotoPath({ gender: 'male', photo_path: null })).toBeNull()
    expect(displayPhotoPath(null)).toBeNull()
  })
})
