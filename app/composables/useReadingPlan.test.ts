import { describe, expect, it } from 'vitest'
import { toReadingUnits } from './useReadingPlan'

describe('صفوف مقرّرات القراءة', () => {
  it('ترتّب المقرّرات وأجزاءها، وتأخذ اسم الكتاب ومؤلفه', () => {
    const units = toReadingUnits([
      { id: 3, sort_order: 3, title: 'المقرّر الثالث', parts: [
        { page_from: 1, page_to: 124, sort_order: 2, book: { title: 'اليوم النبوي', author: 'الطريري' } },
        { page_from: 165, page_to: 196, sort_order: 1, book: { title: 'صفقات رابحة', author: null } }
      ] },
      { id: 1, sort_order: 1, title: 'المقرّر الأول', parts: [] }
    ])
    expect(units.map(u => u.id)).toEqual([1, 3])
    expect(units[1]!.parts.map(p => p.book)).toEqual(['صفقات رابحة', 'اليوم النبوي'])
    expect(units[1]!.parts[1]!.author).toBe('الطريري')
    expect(units[0]!.pdfPath).toBeNull()
  })

  it('مسارُ ملفّ المقرّر يُنقل كما هو', () => {
    expect(toReadingUnits([{ id: 1, sort_order: 1, title: 'أ', pdf_path: 'units/1.pdf', parts: [] }])[0]!.pdfPath).toBe('units/1.pdf')
  })

  it('كتابٌ غائب (حُذف) يُعرض شرطة', () => {
    expect(toReadingUnits([{ id: 1, sort_order: 1, title: 'أ', parts: [{ page_from: 1, page_to: 2, sort_order: 1, book: null }] }])[0]!.parts[0]!.book).toBe('—')
  })
})
