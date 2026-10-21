import { describe, expect, it } from 'vitest'
import { coverFileCheck, partsError, pdfFileError, unitPdfPath, unitTitle } from './useReadingAdmin'

describe('إدارة البرامج المصاحبة', () => {
  it('تسميةُ المقرّر بالترتيب، وبالرقم بعد الثاني عشر', () => {
    expect(unitTitle(1)).toBe('المقرّر الأول')
    expect(unitTitle(5)).toBe('المقرّر الخامس')
    expect(unitTitle(13)).toBe('المقرّر 13')
  })

  it('مسارُ الملفّ بمعرّف المقرّر', () => {
    expect(unitPdfPath(7)).toBe('units/7.pdf')
  })

  it('الملفّ: PDF وحده، وحتى 50 م.ب', () => {
    expect(pdfFileError({ type: 'application/pdf', size: 20e6, name: 'a.pdf' })).toBeNull()
    expect(pdfFileError({ type: '', size: 1e6, name: 'B.PDF' })).toBeNull()
    expect(pdfFileError({ type: 'image/png', size: 1e6, name: 'a.png' })).toBe('الملفّ يجب أن يكون PDF.')
    expect(pdfFileError({ type: 'application/pdf', size: 60 * 1024 * 1024, name: 'a.pdf' })).toBe('الملفّ أكبر من 50 م.ب.')
  })

  it('الغلاف: صورةٌ بامتداد نوعها، وحتى 3 م.ب', () => {
    expect(coverFileCheck({ type: 'image/jpeg', size: 1e6 })).toEqual({ ext: 'jpg' })
    expect(coverFileCheck({ type: 'image/webp', size: 1e6 })).toEqual({ ext: 'webp' })
    expect(coverFileCheck({ type: 'application/pdf', size: 1e6 })).toEqual({ error: 'الغلاف يجب أن يكون صورة JPG أو PNG أو WEBP.' })
    expect(coverFileCheck({ type: 'image/png', size: 4 * 1024 * 1024 })).toEqual({ error: 'صورة الغلاف أكبر من 3 م.ب.' })
  })

  it('أجزاء المقرّر: كتابٌ وصفحاتٌ صحيحة ضمن الكتاب', () => {
    const books = [{ id: 1, pages: 142 }, { id: 2, pages: null }]
    expect(partsError([{ bookId: 1, from: '89', to: '142' }], books)).toBeNull()
    expect(partsError([], books)).toBe('أضف كتاباً واحداً على الأقلّ.')
    expect(partsError([{ bookId: undefined, from: '1', to: '2' }], books)).toBe('اختر كتاب الجزء 1.')
    expect(partsError([{ bookId: 1, from: '50', to: '10' }], books)).toBe('صفحات الجزء 1 غير صحيحة.')
    expect(partsError([{ bookId: 1, from: '1', to: '150' }], books)).toBe('الجزء 1 يتجاوز صفحات الكتاب (142).')
    expect(partsError([{ bookId: 2, from: '1', to: '999' }], books)).toBeNull()
  })
})
