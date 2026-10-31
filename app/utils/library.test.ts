import { describe, expect, it } from 'vitest'
import { fileSize, groupByCategory, idCardExt, idCardFileError, idCardZipName, libraryDraftError, libraryExt, libraryFileError } from './library'

describe('ملفّاتُ المكتبة', () => {
  it('الامتدادُ المقبول', () => {
    expect(libraryExt('الملزمة 1.PDF')).toBe('pdf')
    expect(libraryExt('صورة.jpeg')).toBe('jpg')
    expect(libraryExt('خطة.xlsx')).toBe('xlsx')
    expect(libraryExt('برنامج.exe')).toBeNull()
    expect(libraryExt('بلا امتداد')).toBeNull()
  })
  it('أخطاءُ الملفّ', () => {
    expect(libraryFileError({ name: 'a.pdf', size: 1000 })).toBeNull()
    expect(libraryFileError({ name: 'a.docx', size: 1000 }, true)).toBe('الملزمة ملفُّ PDF.')
    expect(libraryFileError({ name: 'a.zip', size: 1000 })).toMatch(/غيرُ مقبول/)
    expect(libraryFileError({ name: 'a.pdf', size: 0 })).toBe('الملفّ فارغ.')
    expect(libraryFileError({ name: 'a.pdf', size: 51 * 1024 * 1024 })).toMatch(/50 ميغا/)
  })
  it('بياناتُ المستند', () => {
    const ok = { title: 'دليل المعلّم', description: '', category: 'الأدلّة', audience: 'all' as const }
    expect(libraryDraftError(ok)).toBeNull()
    expect(libraryDraftError({ ...ok, title: '  ' })).toBe('اكتب عنوان المستند.')
    expect(libraryDraftError({ ...ok, category: '' })).toMatch(/التصنيف/)
    expect(libraryDraftError({ ...ok, description: 'x'.repeat(501) })).toMatch(/الوصف/)
  })
  it('الحجمُ مقروءاً والتجميع', () => {
    expect(fileSize(350 * 1024)).toBe('350 ك.ب')
    expect(fileSize(2.45 * 1024 * 1024)).toBe('2.5 م.ب')
    expect(fileSize(10)).toBe('1 ك.ب')
    const g = groupByCategory([{ category: 'عام' }, { category: 'النماذج' }, { category: 'الخطط' }, { category: 'النماذج' }])
    expect(g.map(x => x.category)).toEqual(['الخطط', 'النماذج', 'عام'])
    expect(g[1]!.items).toHaveLength(2)
  })
})

describe('صورُ الهويات', () => {
  it('النوعُ والحجم', () => {
    expect(idCardExt('image/jpeg')).toBe('jpg')
    expect(idCardExt('application/pdf')).toBe('pdf')
    expect(idCardExt('image/gif')).toBeNull()
    expect(idCardFileError({ type: 'image/heic', size: 10 })).toMatch(/اختر صورةً/)
    expect(idCardFileError({ type: 'image/jpeg', size: 20 * 1024 * 1024 })).toBeNull()
    expect(idCardFileError({ type: 'application/pdf', size: 6 * 1024 * 1024 })).toMatch(/5 ميغا/)
  })
  it('اسمُ الملفّ في المضغوط فريدٌ وآمن', () => {
    const taken = new Set<string>()
    expect(idCardZipName('1049', 'أمجد / أبو مطر', 'jpg', taken)).toBe('1049 - أمجد أبو مطر.jpg')
    expect(idCardZipName(null, 'سارة', 'pdf', taken)).toBe('سارة.pdf')
    expect(idCardZipName(null, 'سارة', 'pdf', taken)).toBe('سارة (2).pdf')
  })
})
