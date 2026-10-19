/**
 * مراجعُ القرآن في العميل: تحويلُ صفوف `program_juz` إلى أجزاء الموضع بترتيب الحفظ.
 */
import { describe, expect, it } from 'vitest'
import { toProgramJuz } from './useQuranReference'

const row = (number: number, ss: number, sa: number, es: number, ea: number) =>
  ({ number, start_surah: ss, start_ayah: sa, end_surah: es, end_ayah: ea })

describe('toProgramJuz', () => {
  it('يحوّل الأعمدةَ المسطّحة إلى موضعَي بداية ونهاية', () => {
    expect(toProgramJuz([row(30, 114, 1, 78, 40)])).toEqual([
      { number: 30, start: { surah: 114, ayah: 1 }, end: { surah: 78, ayah: 40 } }
    ])
  })

  it('يرتّب بترتيب الحفظ: الجزء 30 أولاً والجزء 1 آخراً مهما كان ترتيب الإدخال', () => {
    const out = toProgramJuz([row(1, 2, 253, 1, 7), row(30, 114, 1, 78, 40), row(2, 2, 142, 2, 252)])
    expect(out.map(j => j.number)).toEqual([30, 2, 1])
  })

  it('لا يغيّر المدخلات ويردّ مصفوفةً فارغةً لمدخلٍ فارغ', () => {
    const input = [row(1, 2, 253, 1, 7), row(30, 114, 1, 78, 40)]
    toProgramJuz(input)
    expect(input[0]!.number).toBe(1)
    expect(toProgramJuz([])).toEqual([])
  })
})
