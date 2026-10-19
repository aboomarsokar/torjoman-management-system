/**
 * صفحاتُ المصحف: فهرسٌ مصغّرٌ مركّبٌ يدوياً لكلّ حالة، وآخرُ حقيقيٌّ مقروءٌ
 * من هجرة المراجع نفسها فلا يتباعد الاختبارُ عن القاعدة.
 */
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'
import { pageOf, pagesMemorized, surahFirstPage, surahLastPage, type MushafPage } from './mushaf'

/** السلسلةُ `'1,1;2,1;…'` من هجرة المراجع، مفكوكةً إلى فهرس (رقمُ الصفحة = موضعها 1..604). */
function realIndex(): MushafPage[] {
  const sql = readFileSync(join(process.cwd(), 'supabase/migrations/20261019090831_quran_reference.sql'), 'utf8')
  const literal = sql.match(/string_to_array\('([\d,;]+)'/)?.[1]
  if (!literal) throw new Error('سلسلة فهرس الصفحات غير موجودة في الهجرة')
  return literal.split(';').map((pair, i) => {
    const [surah, ayah] = pair.split(',').map(Number)
    return { page: i + 1, surah: surah!, ayah: ayah! }
  })
}

/** مصغّر: السورة 2 على الصفحتين 2–3، والثالثة على 4–5، والرابعة على 6. */
const MINI: MushafPage[] = [
  { page: 1, surah: 1, ayah: 1 },
  { page: 2, surah: 2, ayah: 1 },
  { page: 3, surah: 2, ayah: 50 },
  { page: 4, surah: 3, ayah: 1 },
  { page: 5, surah: 3, ayah: 30 },
  { page: 6, surah: 4, ayah: 1 }
]

describe('فهرسٌ مصغّر', () => {
  it('pageOf: آخرُ صفحةٍ تبدأ عند الموضع أو قبله', () => {
    expect(pageOf(MINI, 2, 49)?.page).toBe(2)
    expect(pageOf(MINI, 2, 50)?.page).toBe(3)
    expect(pageOf(MINI, 3, 29)?.page).toBe(4)
    expect(pageOf(MINI, 4, 5)?.page).toBe(6)
  })

  it('pageOf: فهرسٌ فارغ ← null، وقبل الأولى ← الأولى', () => {
    expect(pageOf([], 1, 1)).toBeNull()
    expect(pageOf(MINI, 0, 1)?.page).toBe(1)
  })

  it('أولُ صفحةٍ في السورة وآخرُها', () => {
    expect(surahFirstPage(MINI, 2)).toBe(2)
    expect(surahLastPage(MINI, 2)).toBe(3)
    expect(surahFirstPage(MINI, 3)).toBe(4)
    expect(surahLastPage(MINI, 3)).toBe(5)
    expect(surahLastPage([], 3)).toBeNull()
  })

  it('جزءٌ داخل سورةٍ واحدة يعطي صفحاتِه', () => {
    expect(pagesMemorized(MINI, { surah: 2, ayah: 1 }, { surah: 2, ayah: 50 })).toBe(2)
    expect(pagesMemorized(MINI, { surah: 2, ayah: 1 }, { surah: 2, ayah: 49 })).toBe(1)
  })

  it('موضعان في صفحةٍ واحدة صفحةٌ لا صفر', () => {
    expect(pagesMemorized(MINI, { surah: 2, ayah: 60 }, { surah: 2, ayah: 60 })).toBe(1)
  })

  it('عبر السور: من أول الرابعة إلى منتصف الثالثة تُحسب كاملةُ الرابعة وما نزل من الثالثة', () => {
    expect(pagesMemorized(MINI, { surah: 4, ayah: 1 }, { surah: 3, ayah: 30 })).toBe(3)
  })

  it('فهرسٌ فارغ ← null', () => {
    expect(pagesMemorized([], { surah: 2, ayah: 1 }, { surah: 2, ayah: 5 })).toBeNull()
  })
})

describe('الفهرسُ الحقيقيّ', () => {
  const real = realIndex()

  it('604 صفحاتٍ متتابعة، والوقائعُ المتحقَّقة من القاعدة', () => {
    expect(real).toHaveLength(604)
    expect(pageOf(real, 78, 1)?.page).toBe(582)
    expect(pageOf(real, 2, 142)?.page).toBe(22)
    expect(pageOf(real, 36, 1)?.page).toBe(440)
    expect(pageOf(real, 114, 6)?.page).toBe(604)
  })

  it('الناس 1 ← النبأ 40 = 604 − صفحة النبأ 1 + 1', () => {
    const nabaPage = pageOf(real, 78, 1)!.page
    expect(nabaPage).toBe(582)
    expect(pagesMemorized(real, { surah: 114, ayah: 1 }, { surah: 78, ayah: 40 })).toBe(604 - nabaPage + 1)
  })

  it('الفاتحة وحدها صفحةٌ، والمصحفُ كلُّه 604', () => {
    expect(pagesMemorized(real, { surah: 1, ayah: 1 }, { surah: 1, ayah: 7 })).toBe(1)
    expect(pagesMemorized(real, { surah: 114, ayah: 1 }, { surah: 1, ayah: 7 })).toBe(604)
  })

  it('جزءٌ داخل سورةٍ واحدة: البقرة 142 ← 252', () => {
    const first = pageOf(real, 2, 142)!.page
    const last = pageOf(real, 2, 252)!.page
    expect(pagesMemorized(real, { surah: 2, ayah: 142 }, { surah: 2, ayah: 252 })).toBe(last - first + 1)
  })

  it('النطاقُ المقلوب يعطي القيمة نفسها', () => {
    const pairs: Array<[{ surah: number, ayah: number }, { surah: number, ayah: number }]> = [
      [{ surah: 114, ayah: 1 }, { surah: 78, ayah: 40 }],
      [{ surah: 47, ayah: 20 }, { surah: 40, ayah: 10 }],
      [{ surah: 2, ayah: 142 }, { surah: 2, ayah: 252 }]
    ]
    for (const [a, b] of pairs) {
      expect(pagesMemorized(real, b, a)).toBe(pagesMemorized(real, a, b))
    }
  })
})
