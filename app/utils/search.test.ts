/**
 * بحث القوائم — الأرقام العربية، والتشكيل، وأشكال الألف، وتعدّد الكلمات والحقول.
 */
import { describe, expect, it } from 'vitest'
import { matchesSearch, normalizeSearch } from './search'

describe('normalizeSearch', () => {
  it('يطبّع الأرقام العربية والتشكيل والألف والتاء والياء', () => {
    expect(normalizeSearch('  أحْمَد ١٠٠٩ ')).toBe('احمد 1009')
    expect(normalizeSearch('فاطمة')).toBe('فاطمه')
    expect(normalizeSearch('مصطفى')).toBe('مصطفي')
  })
})

describe('matchesSearch', () => {
  it('الاستعلام الفارغ يطابق الكل', () => {
    expect(matchesSearch('  ', 'أي شيء')).toBe(true)
  })
  it('يطابق الاسم جزئياً بلا اعتبار للهمزة', () => {
    expect(matchesSearch('احمد', 'تجريبي — أحمد', '100000001')).toBe(true)
  })
  it('يطابق رقم الهوية أو الرقم الوظيفي المكتوب بالأرقام العربية', () => {
    expect(matchesSearch('١٠٠٠٠٠٠٢٤', 'هاجر', '100000024')).toBe(true)
    expect(matchesSearch('1009', 'معلم', '1009')).toBe(true)
  })
  it('كل الكلمات يجب أن توجد', () => {
    expect(matchesSearch('محمد سكر', 'محمد سالم أديب سكر')).toBe(true)
    expect(matchesSearch('محمد خالد', 'محمد سالم أديب سكر')).toBe(false)
  })
  it('يتجاهل الحقول الفارغة', () => {
    expect(matchesSearch('هاجر', null, undefined, 'هاجر')).toBe(true)
  })
})
