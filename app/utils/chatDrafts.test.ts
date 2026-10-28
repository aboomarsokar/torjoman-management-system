import { describe, expect, it } from 'vitest'
import { bookletReadyDraft, copiesLabel, greetTeacher, studentRequestDraft } from './chatDrafts'

describe('greetTeacher / copiesLabel', () => {
  it('الاسمُ الأوّل وحده، وبلا اسم تحيّةٌ مجرّدة', () => {
    expect(greetTeacher('محمود إبراهيم موسى بهار')).toBe('السلام عليكم أ. محمود')
    expect(greetTeacher(null)).toBe('السلام عليكم')
  })
  it('جمعُ النسخ', () => {
    expect(copiesLabel(1)).toBe('نسخة واحدة')
    expect(copiesLabel(2)).toBe('نسختان')
    expect(copiesLabel(3)).toBe('3 نسخ')
    expect(copiesLabel(17)).toBe('17 نسخة')
  })
})

describe('bookletReadyDraft / studentRequestDraft', () => {
  it('الملزمةُ جاهزة بالمذكّر والمؤنّث', () => {
    expect(bookletReadyDraft('محمود إبراهيم موسى بهار', 2, 3, false)).toBe('السلام عليكم أ. محمود، ملزمة الجزء 27 + 28 (3 نسخ) جاهزة، تفضّل للاستلام.')
    expect(bookletReadyDraft('علياء سعيد', 2, 17, true)).toBe('السلام عليكم أ. علياء، ملزمة الجزء 27 + 28 (17 نسخة) جاهزة، تفضّلي للاستلام.')
  })
  it('سؤالٌ عن طلب الإضافة', () => {
    expect(studentRequestDraft('سجى حسن', 'آية أحمد', true)).toBe('السلام عليكم أ. سجى، بخصوص طلب إضافة الطالبة آية أحمد: ')
  })
  it('وعن طلب الحذف', () => {
    expect(studentRequestDraft('سجى حسن', 'آية أحمد', true, 'remove')).toBe('السلام عليكم أ. سجى، بخصوص طلب حذف الطالبة آية أحمد: ')
  })
})
