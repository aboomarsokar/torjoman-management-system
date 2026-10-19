/** البحثُ العربيّ المتسامح في قوائم السور: يطابق ما يكتبه المستخدم لا ما كتبناه. */
import { describe, expect, it } from 'vitest'
import { arabicFold, filterByLabel, searchKey } from './arabicSearch'

const SURAHS = [
  { label: '1. الفاتحة' },
  { label: '3. آل عمران' },
  { label: '36. يس', aliases: ['ياسين'] },
  { label: '42. الشورى' },
  { label: '76. الإنسان' },
  { label: '78. النبأ' },
  { label: '114. الناس' }
]

const labels = (query: string) => filterByLabel(SURAHS, query).map(one => one.label)

describe('filterByLabel', () => {
  it('«يس» و«ياسين» يجدان «يس»', () => {
    expect(labels('يس')).toEqual(['36. يس'])
    expect(labels('ياسين')).toEqual(['36. يس'])
  })

  it('الهمزة تسقط: «النبا» ← «النبأ» و«ال عمران» ← «آل عمران»', () => {
    expect(labels('النبا')).toEqual(['78. النبأ'])
    expect(labels('ال عمران')).toEqual(['3. آل عمران'])
  })

  it('الياء والألفُ المقصورة والتاء المربوطة والتشكيل', () => {
    expect(labels('الشوري')).toEqual(['42. الشورى'])
    expect(labels('الفاتحه')).toEqual(['1. الفاتحة'])
    expect(labels('النَّاس')).toEqual(['114. الناس'])
  })

  it('رقمُ السورة بالعربية والهندية', () => {
    expect(labels('42')).toEqual(['42. الشورى'])
    expect(labels('٤٢')).toEqual(['42. الشورى'])
  })

  it('الطلبُ الفارغ يُعيد القائمةَ كلَّها، وما لا يطابق فارغ', () => {
    expect(filterByLabel(SURAHS, '   ')).toHaveLength(SURAHS.length)
    expect(labels('زززز')).toEqual([])
  })

  it('التطبيعُ للمطابقة لا للعرض', () => {
    expect(filterByLabel(SURAHS, 'الشوري')[0]?.label).toBe('42. الشورى')
  })
})

describe('arabicFold / searchKey', () => {
  it('arabicFold يوحّد الحروف', () => {
    expect(arabicFold('الصفّ  القرآنى')).toBe('الصف القراني')
  })

  it('searchKey يطبّع الحرفَ والرقمَ معاً', () => {
    expect(searchKey('  الشُّورى ٤٢  ')).toBe('الشوري 42')
  })
})
