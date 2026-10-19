/** مواضعُ الحفظ بترتيبه: من الناس إلى الفاتحة، والآيةُ داخل السورة تصاعدياً. */
import { describe, expect, it } from 'vitest'
import {
  comparePositions,
  completedJuz,
  isInMemorizationOrder,
  isKhatm,
  nextPosition,
  startForNewStudent,
  type ProgramJuz
} from './position'

const p = (surah: number, ayah: number) => ({ surah, ayah })

/** أجزاءُ البرنامج الثلاثون كما في هجرة المراجع (Task 1). */
const JUZ: ProgramJuz[] = ([
  [30, 114, 1, 78, 40], [29, 77, 1, 67, 30], [28, 66, 1, 58, 22], [27, 57, 1, 51, 60], [26, 50, 1, 46, 35],
  [25, 45, 1, 42, 53], [24, 41, 1, 39, 75], [23, 38, 1, 36, 83], [22, 35, 1, 33, 73], [21, 32, 1, 29, 69],
  [20, 28, 1, 27, 93], [19, 26, 1, 25, 77], [18, 24, 1, 23, 118], [17, 22, 1, 21, 112], [16, 20, 1, 19, 98],
  [15, 18, 1, 17, 111], [14, 16, 1, 15, 99], [13, 14, 1, 12, 111], [12, 11, 1, 11, 123], [11, 10, 1, 10, 109],
  [10, 9, 1, 9, 129], [9, 8, 1, 8, 75], [8, 7, 1, 7, 206], [7, 6, 1, 6, 165], [6, 5, 1, 5, 120],
  [5, 4, 1, 4, 176], [4, 3, 1, 3, 200], [3, 2, 1, 2, 141], [2, 2, 142, 2, 252], [1, 2, 253, 1, 7]
] as const).map(([number, ss, sa, es, ea]) => ({ number, start: p(ss, sa), end: p(es, ea) }))

/** عددُ آيات السور اللازمةُ للاختبار فقط. */
const AYAHS: Record<number, number> = { 1: 7, 2: 286, 113: 5, 114: 6 }
const ayahCountOf = (surah: number) => AYAHS[surah] ?? 10

describe('comparePositions', () => {
  it('الأعلى رقماً يسبق (الناس قبل الفلق)', () => {
    expect(comparePositions(p(114, 1), p(113, 1))).toBeLessThan(0)
    expect(comparePositions(p(113, 1), p(114, 1))).toBeGreaterThan(0)
  })

  it('داخل السورة الأصغرُ آيةً يسبق', () => {
    expect(comparePositions(p(2, 1), p(2, 142))).toBeLessThan(0)
  })

  it('آخرُ البقرة قبل الفاتحة، والمتساويان صفر', () => {
    expect(comparePositions(p(2, 286), p(1, 1))).toBeLessThan(0)
    expect(comparePositions(p(5, 5), p(5, 5))).toBe(0)
  })
})

describe('isInMemorizationOrder', () => {
  it('from ≤ to', () => {
    expect(isInMemorizationOrder(p(114, 1), p(78, 40))).toBe(true)
    expect(isInMemorizationOrder(p(78, 40), p(114, 1))).toBe(false)
    expect(isInMemorizationOrder(p(2, 5), p(2, 5))).toBe(true)
  })
})

describe('nextPosition', () => {
  it('آخرُ السورة ← أولُ التي تليها بالترتيب النازل', () => {
    expect(nextPosition(p(114, 6), ayahCountOf)).toEqual(p(113, 1))
  })

  it('داخل السورة الآيةُ التالية', () => {
    expect(nextPosition(p(2, 141), ayahCountOf)).toEqual(p(2, 142))
  })

  it('بعد الفاتحة 1:7 الختمُ: null', () => {
    expect(nextPosition(p(1, 7), ayahCountOf)).toBeNull()
  })
})

describe('completedJuz', () => {
  it('بلا موضعٍ صفر', () => {
    expect(completedJuz(null, JUZ)).toBe(0)
  })

  it('الجزءُ يكتمل ببلوغ نهايته لا قبلها', () => {
    expect(completedJuz(p(78, 40), JUZ)).toBe(1)
    expect(completedJuz(p(78, 39), JUZ)).toBe(0)
  })

  it('الختمُ ثلاثون', () => {
    expect(completedJuz(p(1, 7), JUZ)).toBe(30)
  })
})

describe('startForNewStudent', () => {
  it('من لا يحفظ شيئاً يبدأ من الناس', () => {
    expect(startForNewStudent(0, JUZ)).toEqual(p(114, 1))
  })

  it('من يحفظ 3 أجزاء يبدأ من الجزء 27: الحديد 1', () => {
    expect(startForNewStudent(3, JUZ)).toEqual(p(57, 1))
  })

  it('من أتمّ الثلاثين لا بداية، وما خرج عن المدى يُقيَّد', () => {
    expect(startForNewStudent(30, JUZ)).toBeNull()
    expect(startForNewStudent(45, JUZ)).toBeNull()
    expect(startForNewStudent(-2, JUZ)).toEqual(p(114, 1))
  })

  it('يُرجع نسخةً لا مرجعاً إلى القائمة', () => {
    const start = startForNewStudent(0, JUZ)!
    start.ayah = 99
    expect(JUZ[0]!.start.ayah).toBe(1)
  })
})

describe('isKhatm', () => {
  it('الفاتحة 1:7 وحدها', () => {
    expect(isKhatm(p(1, 7))).toBe(true)
    expect(isKhatm(p(1, 6))).toBe(false)
    expect(isKhatm(p(2, 7))).toBe(false)
    expect(isKhatm(null)).toBe(false)
  })
})
