/** دوراتُ الاختبار المرحليّة: التسميات والمستحقّة والحدودُ من تقسيمة البرنامج الحقيقية. */
import { describe, expect, it } from 'vitest'
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { toProgramJuz } from '~/utils/quran/position'
import {
  CYCLE_COLUMNS, CYCLE_LABELS, PUBLIC_CYCLE_COLUMNS, STAGE_LABELS, cycleLabel, cycleRange, cycleShort, cycleSpan, cycleSpanLabel,
  dueCycle, partsAfterPass, partsCount, reachedHint, toExamCycle, type ExamCycle
} from './cycles'

// الدوراتُ الخمس عشرة كما في هجرة exam_cycles
const RAW: [number, number, number, number, number, string][] = [
  [1, 1, 1, 28, 30, 'المجادلة – الناس'], [2, 1, 2, 26, 30, 'الأحقاف – الناس'], [3, 1, 3, 23, 25, 'يس – الجاثية'],
  [4, 1, 4, 21, 25, 'العنكبوت – الجاثية'], [5, 1, 5, 21, 30, 'العنكبوت – الناس'],
  [6, 2, 1, 18, 20, 'المؤمنون – القصص'], [7, 2, 2, 16, 20, 'مريم – القصص'], [8, 2, 3, 13, 15, 'يوسف – الكهف'],
  [9, 2, 4, 11, 15, 'يونس – الكهف'], [10, 2, 5, 11, 20, 'يونس – القصص'],
  [11, 3, 1, 8, 10, 'الأعراف – التوبة'], [12, 3, 2, 6, 10, 'المائدة – التوبة'], [13, 3, 3, 3, 5, 'البقرة – النساء'],
  [14, 3, 4, 1, 5, 'البقرة – النساء'], [15, 3, 5, 1, 10, 'البقرة – التوبة']
]
const CYCLES: ExamCycle[] = RAW.map(([id, stage_number, cycle_number, parts_from, parts_to, surahs_label]) =>
  ({ id, stage_number, cycle_number, parts_from, parts_to, surahs_label, sort_order: id }))
const c = (id: number) => CYCLES.find(x => x.id === id)!

// تقسيمةُ البرنامج الحقيقية من هجرة المراجع (لا نسخةٌ يدوية)
const sql = readFileSync(resolve(__dirname, '../../../supabase/migrations/20261019090831_quran_reference.sql'), 'utf8')
const juzBlock = sql.slice(sql.indexOf('insert into public.program_juz'))
const JUZ = toProgramJuz([...juzBlock.slice(0, juzBlock.indexOf(';')).matchAll(/\((\d+),(\d+),(\d+),(\d+),(\d+)\)/g)]
  .map(m => ({ number: +m[1]!, start_surah: +m[2]!, start_ayah: +m[3]!, end_surah: +m[4]!, end_ayah: +m[5]! })))

describe('toExamCycle وأعمدتُها', () => {
  it('الترتيبُ الفارغ صفر ويبقى المملوء', () => {
    expect(toExamCycle({ ...c(1), sort_order: null }).sort_order).toBe(0)
    expect(toExamCycle({ ...c(4), sort_order: 4 }).sort_order).toBe(4)
  })
  it('يقبل الصفَّ المقصورَ بلا surahs_label ولا يضيفه', () => {
    const { surahs_label: _s, ...narrow } = c(2)
    expect(toExamCycle({ ...narrow, sort_order: null })).not.toHaveProperty('surahs_label')
  })
  it('أعمدةُ الصفحة العامّة هي الكاملة بلا surahs_label', () => {
    expect(CYCLE_COLUMNS.split(', ').filter(x => x !== 'surahs_label').join(', ')).toBe(PUBLIC_CYCLE_COLUMNS)
  })
})

describe('التسميات', () => {
  it('المراحلُ والدوراتُ بالعربية', () => {
    expect(STAGE_LABELS[1]).toBe('المرحلة الأولى')
    expect(STAGE_LABELS[3]).toBe('المرحلة الثالثة')
    expect(CYCLE_LABELS[1]).toBe('الدورة الأولى')
    expect(CYCLE_LABELS[5]).toBe('الدورة الخامسة')
  })
  it('cycleShort: سطرُ المحطة بلا أسماء السور', () => {
    expect(cycleShort(c(2))).toBe('المرحلة الأولى · الدورة الثانية — الأجزاء 26–30')
  })
  it('cycleLabel', () => {
    expect(cycleLabel(c(1))).toBe('المرحلة الأولى · الدورة الأولى')
    expect(cycleLabel(c(10))).toBe('المرحلة الثانية · الدورة الخامسة')
  })
  it('cycleRange', () => {
    expect(cycleRange(c(1))).toBe('الأجزاء 28–30 (المجادلة – الناس)')
    expect(cycleRange(c(15))).toBe('الأجزاء 1–10 (البقرة – التوبة)')
  })
})

describe('الأجزاء', () => {
  it('partsCount', () => {
    expect(partsCount(c(1))).toBe(3)
    expect(partsCount(c(5))).toBe(10)
  })
  it('partsAfterPass = 31 − parts_from', () => {
    expect(partsAfterPass(c(1))).toBe(3)
    expect(partsAfterPass(c(5))).toBe(10)
    expect(partsAfterPass(c(15))).toBe(30)
  })
})

describe('dueCycle', () => {
  const none = new Set<number>()
  it('لا شيء مجتاز ← الأولى', () => {
    expect(dueCycle(CYCLES, none, none)).toEqual({ cycle: c(1), blocked: null })
  })
  it('الأولى والثانية مجتازتان ← الثالثة', () => {
    expect(dueCycle(CYCLES, new Set([1, 2]), none).cycle?.id).toBe(3)
  })
  it('الترتيبُ بـsort_order لا بترتيب المصفوفة', () => {
    const shuffled = [...CYCLES].reverse()
    expect(dueCycle(shuffled, new Set([1]), none).cycle?.id).toBe(2)
  })
  it('اجتيازٌ خارج التسلسل لا يقفز: الأولى غير مجتازة ← الأولى', () => {
    expect(dueCycle(CYCLES, new Set([2, 3]), none).cycle?.id).toBe(1)
  })
  it('الثالثة معلّقة (مرشّحةٌ بلا نتيجة) ← blocked pending على الثالثة', () => {
    expect(dueCycle(CYCLES, new Set([1, 2]), new Set([3]))).toEqual({ cycle: c(3), blocked: 'pending' })
  })
  it('الكلّ مجتاز ← done', () => {
    expect(dueCycle(CYCLES, new Set(CYCLES.map(x => x.id)), none)).toEqual({ cycle: null, blocked: 'done' })
  })
  it('رسوبٌ في الثالثة (غير مجتازة ولا معلّقة) ← الثالثة نفسها', () => {
    expect(dueCycle(CYCLES, new Set([1, 2]), none)).toEqual({ cycle: c(3), blocked: null })
  })
  it('قائمةٌ فارغة ← done', () => {
    expect(dueCycle([], none, none)).toEqual({ cycle: null, blocked: 'done' })
  })
})

describe('reachedHint', () => {
  it('لم يبلغ حدودَ الدورة', () => {
    expect(reachedHint(c(1), 2)).toBe('لم يبلغ موضعُه المعتمد حدودَ هذه الدورة بعد')
    expect(reachedHint(c(5), 9)).not.toBeNull()
  })
  it('بلغها أو جاوزها ← null', () => {
    expect(reachedHint(c(1), 3)).toBeNull()
    expect(reachedHint(c(1), 30)).toBeNull()
  })
})

describe('cycleSpan (التقسيمةُ الحقيقية)', () => {
  it('تقسيمةُ البرنامج ثلاثون جزءاً', () => {
    expect(JUZ).toHaveLength(30)
  })
  it('الدورة 1 (28–30) ← من الناس 1 إلى المجادلة 22', () => {
    expect(cycleSpan(c(1), JUZ)).toEqual({ from: { surah: 114, ayah: 1 }, to: { surah: 58, ayah: 22 } })
  })
  it('الدورة 8 (13–15) ← من الكهف 1 إلى يوسف 111', () => {
    expect(cycleSpan(c(8), JUZ)).toEqual({ from: { surah: 18, ayah: 1 }, to: { surah: 12, ayah: 111 } })
  })
  it('الدورة 13 (3–5) ← من النساء 1 إلى البقرة 141', () => {
    expect(cycleSpan(c(13), JUZ)).toEqual({ from: { surah: 4, ayah: 1 }, to: { surah: 2, ayah: 141 } })
  })
  it('الدورة 15 (1–10) ← من التوبة 1 إلى الفاتحة 7', () => {
    expect(cycleSpan(c(15), JUZ)).toEqual({ from: { surah: 9, ayah: 1 }, to: { surah: 1, ayah: 7 } })
  })
  it('جزءٌ غائبٌ من التقسيمة ← null', () => {
    expect(cycleSpan(c(1), [])).toBeNull()
    expect(cycleSpan(c(1), JUZ.filter(j => j.number !== 30))).toBeNull()
  })
  it('كلُّ الدورات الخمس عشرة تُحسب وبترتيب الحفظ (من قبل إلى)', () => {
    for (const cy of CYCLES) {
      const s = cycleSpan(cy, JUZ)!
      expect(s).not.toBeNull()
      expect(s.from.surah > s.to.surah || (s.from.surah === s.to.surah && s.from.ayah <= s.to.ayah)).toBe(true)
    }
  })
})

describe('cycleSpanLabel', () => {
  const name = (n: number) => ({ 114: 'الناس', 58: 'المجادلة', 12: 'يوسف', 18: 'الكهف' } as Record<number, string>)[n] ?? `#${n}`
  it('من الناس 1 إلى المجادلة 22', () => {
    expect(cycleSpanLabel(c(1), JUZ, name)).toBe('من الناس 1 إلى المجادلة 22')
  })
  it('بلا تقسيمة ← نصٌّ فارغ', () => {
    expect(cycleSpanLabel(c(1), [], name)).toBe('')
  })
})
