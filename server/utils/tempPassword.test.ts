import { describe, expect, it } from 'vitest'
import { generateTempPassword, TEMP_PASSWORD_ALPHABET, TEMP_PASSWORD_LENGTH, TEMP_PASSWORD_MIN_LENGTH } from './tempPassword'

describe('generateTempPassword', () => {
  it('بالطول الافتراضي (≥10) ومن الأبجدية وحدها', () => {
    for (let i = 0; i < 200; i++) {
      const pw = generateTempPassword()
      expect(pw).toHaveLength(TEMP_PASSWORD_LENGTH)
      expect(TEMP_PASSWORD_LENGTH).toBeGreaterThanOrEqual(10)
      for (const ch of pw) expect(TEMP_PASSWORD_ALPHABET).toContain(ch)
    }
  })

  it('لا محارف ملتبسة: 0 وO و1 وl وI', () => {
    expect(TEMP_PASSWORD_ALPHABET).not.toMatch(/[0O1lI]/)
    const joined = Array.from({ length: 200 }, () => generateTempPassword()).join('')
    expect(joined).not.toMatch(/[0O1lI]/)
  })

  it('رقمٌ وحرفٌ صغير وحرفٌ كبير في كل كلمة', () => {
    for (let i = 0; i < 500; i++) {
      const pw = generateTempPassword()
      expect(pw).toMatch(/\d/)
      expect(pw).toMatch(/[a-z]/)
      expect(pw).toMatch(/[A-Z]/)
    }
  })

  it('لا تقلّ عن الحدّ الأدنى ولو طُلب أقصر، وتحترم الأطول', () => {
    expect(generateTempPassword(4)).toHaveLength(TEMP_PASSWORD_MIN_LENGTH)
    expect(generateTempPassword(20)).toHaveLength(20)
  })

  it('عشوائية: لا تتكرّر بين الاستدعاءات', () => {
    const set = new Set(Array.from({ length: 1000 }, () => generateTempPassword()))
    expect(set.size).toBe(1000)
  })
})
