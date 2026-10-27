import { describe, expect, it } from 'vitest'
import { hasValidCheckDigit } from './nationalId'

describe('hasValidCheckDigit', () => {
  it('يقبل هوياتٍ صحيحة', () => {
    expect(hasValidCheckDigit('432248433')).toBe(true)
    expect(hasValidCheckDigit('431265479')).toBe(true)
    expect(hasValidCheckDigit('999999998')).toBe(true)
  })
  it('يرفض خانةَ تحقّقٍ خاطئة (حالتا الزيناتي والدحدوح)', () => {
    expect(hasValidCheckDigit('432165479')).toBe(false)
    expect(hasValidCheckDigit('830089292')).toBe(false)
  })
  it('يرفض ما ليس تسعَ خانات', () => {
    expect(hasValidCheckDigit('12345678')).toBe(false)
    expect(hasValidCheckDigit('4322484330')).toBe(false)
    expect(hasValidCheckDigit('43224843a')).toBe(false)
  })
})
