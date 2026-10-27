import { describe, expect, it } from 'vitest'
import { SMS_SENDER_SECTION, phonesOutsideSection } from './smsScope'

describe('SMS_SENDER_SECTION', () => {
  it('المديرُ الإداريّ بلا قيد، والفنيّ للبنين، والمديرةُ للبنات، وغيرُهم لا يرسل', () => {
    expect(SMS_SENDER_SECTION.admin_manager).toBeNull()
    expect(SMS_SENDER_SECTION.technical_manager).toBe('male')
    expect(SMS_SENDER_SECTION.women_admin).toBe('female')
    expect('teacher' in SMS_SENDER_SECTION).toBe(false)
  })
})

describe('phonesOutsideSection', () => {
  it('يطابق الصيغ المختلفة ويُرجع الغريب', () => {
    expect(phonesOutsideSection(['0599123456', '0567000000'], ['+970 599 123 456', null, '059-111'])).toEqual(['0567000000'])
  })
})
