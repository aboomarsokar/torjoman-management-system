import { describe, expect, it } from 'vitest'
import type { StudentMonthRow } from './month'
import {
  canEditMonth,
  cardAction,
  defaultPeriod,
  exportRows,
  periodFromQuery,
  planBadge,
  positionLabel,
  recordFormError,
  visibleRows,
  type RecordDraft
} from './screen'

function row(over: Partial<StudentMonthRow> = {}): StudentMonthRow {
  return {
    studentId: 's1',
    name: 'أحمد علي',
    record: null,
    recordedElsewhere: false,
    suggestedFrom: { surah: 114, ayah: 1 },
    suggestedFromPrevious: false,
    daysHeld: 10,
    daysAttended: 8,
    plan: { required: 16, full: 20, basis: 'prorated' },
    outcome: 'unrecorded',
    juzDone: 0,
    khatm: false,
    ...over
  }
}

const counts: Record<number, number> = { 114: 6, 113: 5, 112: 4, 2: 286, 1: 7 }
const ayahCountOf = (s: number) => counts[s] ?? 0
const names: Record<number, string> = { 114: 'الناس', 113: 'الفلق' }
const surahName = (n: number) => names[n] ?? ''

function draft(over: Partial<RecordDraft> = {}): RecordDraft {
  return { none: false, from: { surah: 114, ayah: 1 }, to: { surah: 113, ayah: 5 }, pages: 1, reviewed: null, notes: '', ...over }
}

describe('defaultPeriod', () => {
  it('المعلم: السابقُ إن كان مسوّدةً معلّقة، وإلا الجاري', () => {
    expect(defaultPeriod('2026-11-05', { previousStatus: 'none' })).toEqual({ year: 2026, month: 11 })
    expect(defaultPeriod('2026-11-05', { previousStatus: 'draft' })).toEqual({ year: 2026, month: 10 })
    expect(defaultPeriod('2026-11-05', { previousStatus: 'submitted' })).toEqual({ year: 2026, month: 11 })
    expect(defaultPeriod('2026-11-05', { previousStatus: 'approved' })).toEqual({ year: 2026, month: 11 })
  })
  it('المعلم: يومُ الفتح لا يغيّر القاعدة', () => {
    expect(defaultPeriod('2026-11-30', { previousStatus: 'draft' })).toEqual({ year: 2026, month: 10 })
    expect(defaultPeriod('2026-11-30', { previousStatus: 'none' })).toEqual({ year: 2026, month: 11 })
  })
  it('المعتمِد بلا حلقة (null): السابقُ قبل يوم فتح الجاري، والجاري منه', () => {
    expect(defaultPeriod('2026-11-29', { previousStatus: null })).toEqual({ year: 2026, month: 10 })
    expect(defaultPeriod('2026-11-30', { previousStatus: null })).toEqual({ year: 2026, month: 11 })
  })
  it('لا شهرَ قبل بداية المشروع (10/2026)', () => {
    expect(defaultPeriod('2026-10-30', { previousStatus: null })).toEqual({ year: 2026, month: 10 })
    expect(defaultPeriod('2026-10-20', { previousStatus: 'draft' })).toEqual({ year: 2026, month: 10 })
  })
  it('يعبر حدَّ السنة: يناير ← ديسمبر السابق', () => {
    expect(defaultPeriod('2027-01-10', { previousStatus: null })).toEqual({ year: 2026, month: 12 })
    expect(defaultPeriod('2027-01-10', { previousStatus: 'draft' })).toEqual({ year: 2026, month: 12 })
  })
})

describe('periodFromQuery', () => {
  it('شهرٌ صحيحٌ في المدى', () => {
    expect(periodFromQuery('2026', '10', '2026-10-19')).toEqual({ year: 2026, month: 10 })
    expect(periodFromQuery('2026', '11', '2027-01-19')).toEqual({ year: 2026, month: 11 })
  })
  it('المستقبلُ وما قبل المدى والقيمُ الفاسدة ← null', () => {
    expect(periodFromQuery('2026', '11', '2026-10-19')).toBeNull()
    expect(periodFromQuery('2026', '09', '2026-10-19')).toBeNull()
    expect(periodFromQuery('2025', '1', '2026-10-19')).toBeNull()
    expect(periodFromQuery('2026', '13', '2026-10-19')).toBeNull()
    expect(periodFromQuery('2026', 'x', '2026-10-19')).toBeNull()
    expect(periodFromQuery(undefined, '9', '2026-10-19')).toBeNull()
    expect(periodFromQuery(['2026'], '9', '2026-10-19')).toBeNull()
  })
})

describe('canEditMonth', () => {
  it('المعلم يكتب في المسوّدة وقبل البدء، لا بعد الإرسال', () => {
    const base = { readOnly: false, isTeacher: true, canApprove: false }
    expect(canEditMonth({ ...base, status: null })).toBe(true)
    expect(canEditMonth({ ...base, status: 'draft' })).toBe(true)
    expect(canEditMonth({ ...base, status: 'submitted' })).toBe(false)
    expect(canEditMonth({ ...base, status: 'approved' })).toBe(false)
  })
  it('المعتمِد يكتب ما لم يُعتمد الشهر', () => {
    const base = { readOnly: false, isTeacher: false, canApprove: true }
    expect(canEditMonth({ ...base, status: 'submitted' })).toBe(true)
    expect(canEditMonth({ ...base, status: 'approved' })).toBe(false)
  })
  it('المشرفُ الميدانيّ يعتمد ولا يكتب سجلّاً أيّاً كانت الحالة', () => {
    const base = { readOnly: false, isTeacher: false, canApprove: true, isFieldSupervisor: true }
    expect(canEditMonth({ ...base, status: 'draft' })).toBe(false)
    expect(canEditMonth({ ...base, status: 'submitted' })).toBe(false)
  })
  it('مشرف المشروع والمطّلعُ لا يكتبان', () => {
    expect(canEditMonth({ readOnly: true, isTeacher: false, canApprove: false, status: 'draft' })).toBe(false)
    expect(canEditMonth({ readOnly: false, isTeacher: false, canApprove: false, status: 'draft' })).toBe(false)
  })
})

describe('cardAction', () => {
  it('رصد / تعديل / عرض / لا شيء', () => {
    expect(cardAction(false, true)).toBe('record')
    expect(cardAction(true, true)).toBe('edit')
    expect(cardAction(true, false)).toBe('view')
    expect(cardAction(false, false)).toBeNull()
  })
  it('ما رُصد في الحلقة السابقة للعرض وحدَه ولو ملك الناظرُ الكتابة', () => {
    expect(cardAction(true, true, true)).toBe('view')
    expect(cardAction(true, false, true)).toBe('view')
  })
})

describe('visibleRows', () => {
  const rows = [row({ studentId: 'a', name: 'أحمد', outcome: 'done' }), row({ studentId: 'b', name: 'مُصطفى', outcome: 'short' })]
  it('يرشّح بالنتيجة وبالاسم مطبَّعاً', () => {
    expect(visibleRows(rows, 'short', '').map(r => r.studentId)).toEqual(['b'])
    expect(visibleRows(rows, null, 'احمد').map(r => r.studentId)).toEqual(['a'])
    expect(visibleRows(rows, null, 'مصطفي').map(r => r.studentId)).toEqual(['b'])
    expect(visibleRows(rows, 'done', 'مصطفى')).toEqual([])
  })
})

describe('planBadge', () => {
  it('المطلوبُ والتصنيف، ومن لم يحضر، ومن بلا خطة', () => {
    expect(planBadge(row({ outcome: 'done' }))).toBe('المطلوب 16 · أنجز')
    expect(planBadge(row({ plan: { required: null, full: 20, basis: 'absent' }, outcome: 'unmeasured' }))).toBe('لم يحضر · لا يُقاس')
    expect(planBadge(row({ plan: { required: null, full: 20, basis: 'unheld' }, outcome: 'unmeasured' }))).toBe('التحق بعد الأيام · لا يُقاس')
    expect(planBadge(row({ plan: { required: null, full: null, basis: 'full' }, outcome: 'unrecorded' }))).toBe('بلا مطلوب · لم يُرصد')
  })
})

describe('positionLabel', () => {
  it('اسمُ السورة ورقمُ الآية، والرقمُ إن غاب الاسم', () => {
    expect(positionLabel({ surah: 114, ayah: 3 }, surahName)).toBe('الناس 3')
    expect(positionLabel({ surah: 50, ayah: 2 }, surahName)).toBe('50 2')
    expect(positionLabel(null, surahName)).toBe('—')
  })
})

describe('recordFormError', () => {
  it('السليمُ بلا خطأ، و«لم يحفظ» لا تُفحص مواضعه', () => {
    expect(recordFormError(draft(), ayahCountOf)).toBeNull()
    expect(recordFormError(draft({ none: true, from: { surah: 0, ayah: 0 }, pages: 0 }), ayahCountOf)).toBeNull()
  })
  it('حدودُ الآيات', () => {
    expect(recordFormError(draft({ from: { surah: 114, ayah: 7 } }), ayahCountOf)).toBe('آيةُ البداية بين 1 و6.')
    expect(recordFormError(draft({ to: { surah: 113, ayah: 0 } }), ayahCountOf)).toBe('آيةُ النهاية بين 1 و5.')
    expect(recordFormError(draft({ to: { surah: 50, ayah: 1 } }), ayahCountOf)).toBe('اختر سورتَي البداية والنهاية.')
  })
  it('الترتيبُ: من الناس إلى الفاتحة، والآيةُ داخل السورة تصاعدياً', () => {
    expect(recordFormError(draft({ from: { surah: 113, ayah: 1 }, to: { surah: 114, ayah: 6 } }), ayahCountOf)).toMatch('بترتيب الحفظ')
    expect(recordFormError(draft({ from: { surah: 114, ayah: 4 }, to: { surah: 114, ayah: 2 } }), ayahCountOf)).toMatch('بترتيب الحفظ')
    expect(recordFormError(draft({ from: { surah: 114, ayah: 2 }, to: { surah: 114, ayah: 2 } }), ayahCountOf)).toBeNull()
  })
  it('الصفحاتُ والمراجعةُ 0–604، والملاحظاتُ ≤ 500', () => {
    expect(recordFormError(draft({ pages: 605 }), ayahCountOf)).toMatch('الصفحاتُ المحفوظة')
    expect(recordFormError(draft({ pages: null }), ayahCountOf)).toMatch('الصفحاتُ المحفوظة')
    expect(recordFormError(draft({ reviewed: -1 }), ayahCountOf)).toMatch('المراجعة')
    expect(recordFormError(draft({ reviewed: 604 }), ayahCountOf)).toBeNull()
    expect(recordFormError(draft({ notes: 'x'.repeat(501) }), ayahCountOf)).toMatch('500')
  })
})

describe('exportRows', () => {
  it('صفٌّ بالأعمدة الثمانية، وغيرُ المرصود بخاناتٍ فارغة', () => {
    const recorded = row({
      record: { id: 'r', from: { surah: 114, ayah: 1 }, to: { surah: 113, ayah: 5 }, pagesMemorized: 1, pagesReviewed: 4, notes: null },
      outcome: 'short'
    })
    expect(exportRows([recorded, row()], surahName)).toEqual([
      ['أحمد علي', 'الناس 1', 'الفلق 5', 1, 4, '8/10', 16, 'مقصّر'],
      ['أحمد علي', '', '', null, null, '8/10', 16, 'لم يُرصد']
    ])
  })
})
