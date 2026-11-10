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
  it('موعدُ الفتح وبنودُ الخارطة، والنوعُ المجهولُ صفحات', () => {
    const [u] = toReadingUnits([{ id: 3, sort_order: 3, title: 'ج', opens_on: '2026-12-01', parts: [], items: [
      { week: 3, sort_order: 1, kind: 'lecture', page_from: null, page_to: null, title: 'القلب المنيب', speaker: 'د. أحمد السيد', duration_seconds: 1723, url: null, book: null },
      { week: 1, sort_order: 1, kind: 'x', page_from: 165, page_to: 186, title: null, speaker: null, duration_seconds: null, url: null, book: { title: 'صفقات رابحة' } }
    ] }])
    expect(u!.opensOn).toBe('2026-12-01')
    expect(u!.items!.map(i => [i.kind, i.book ?? i.title, i.durationSeconds])).toEqual([['lecture', 'القلب المنيب', 1723], ['pages', 'صفقات رابحة', null]])
  })
})
