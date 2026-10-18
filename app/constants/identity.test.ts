import { describe, expect, it } from 'vitest'
import { classifyLoginId, digitsOnly, isValidEmployeeNumber, isValidIdentity, normalizeDigits } from './identity'

describe('normalizeDigits', () => {
  it('يحوّل الأرقام العربية والفارسية', () => {
    expect(normalizeDigits('١٠٠١')).toBe('1001')
    expect(normalizeDigits('۴۰۷')).toBe('407')
  })
})

describe('digitsOnly', () => {
  it('يُسقط المسافات والشُّرَط', () => {
    expect(digitsOnly(' ٤٠٧ ٧٠٦-٩٥١ ')).toBe('407706951')
  })
})

describe('isValidIdentity / isValidEmployeeNumber', () => {
  it('الهوية 9 خانات بالضبط', () => {
    expect(isValidIdentity('407706951')).toBe(true)
    expect(isValidIdentity('40770695')).toBe(false)
  })
  it('الرقم الوظيفي 4 خانات بالضبط', () => {
    expect(isValidEmployeeNumber('١٠٠١')).toBe(true)
    expect(isValidEmployeeNumber('101')).toBe(false)
    expect(isValidEmployeeNumber('10011')).toBe(false)
  })
})

describe('classifyLoginId', () => {
  it('4 خانات = موظف، 9 = طالب، وغير ذلك غير صالح', () => {
    expect(classifyLoginId(' ١٠٠٢ ')).toEqual({ kind: 'staff', id: '1002' })
    expect(classifyLoginId('407 706 951')).toEqual({ kind: 'student', id: '407706951' })
    expect(classifyLoginId('12345')).toEqual({ kind: 'invalid' })
    expect(classifyLoginId('abc')).toEqual({ kind: 'invalid' })
  })
})
