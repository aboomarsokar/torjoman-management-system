/**
 * بحث القوائم — الأرقام العربية، والتشكيل، وأشكال الألف، وتعدّد الكلمات والحقول.
 */
import { describe, expect, it } from 'vitest'
import { matchesSearch, normalizeSearch, searchWordPattern, serverSearchClauses } from './search'

describe('searchWordPattern — نمطُ الخادم يقبل ما يقبله البحثُ المحلّيّ', () => {
  const hits = (word: string, name: string) => new RegExp(searchWordPattern(normalizeSearch(word)), 'i').test(name)
  it('أشكالُ الألف والتاء والياء والتشكيلُ في الاسم المخزَّن', () => {
    expect(hits('اسامه', 'أسامة الناجي')).toBe(true)
    expect(hits('سجي', 'سجىٰ حَسن')).toBe(true)
    expect(hits('حسن', 'سجىٰ حَسن')).toBe(true)
    expect(hits('محمود', 'محمد')).toBe(false)
  })
  it('رموزُ regex في البحث تُهرَّب فلا تُفسَّر', () => {
    expect(hits('a.b', 'axb')).toBe(false)
    expect(hits('(', 'محمد (أبو)')).toBe(true)
  })
})

describe('serverSearchClauses', () => {
  it('شرطٌ لكلّ كلمة، والرقميّةُ تُطابَق في الهوية أيضاً (بالأرقام اللاتينية)', () => {
    const c = serverSearchClauses('محمد ٤٣١', 'full_name', 'national_id')
    expect(c).toHaveLength(2)
    expect(c[0]).toMatch(/^full_name\.imatch\."/)
    expect(c[1]).toContain('national_id.ilike."*431*"')
  })
  it('الاستعلامُ الفارغ بلا شروط، وعلامةُ التنصيص تُهرَّب', () => {
    expect(serverSearchClauses('   ', 'full_name')).toEqual([])
    expect(serverSearchClauses('a"b', 'full_name')[0]).toContain('\\"')
  })
})

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
