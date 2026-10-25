import { describe, expect, it } from 'vitest'
import { messageError, seenCount, type MessageDraft } from './useStaffMessages'
import { audienceLabel } from '~/constants/announcements'

const group: MessageDraft = { mode: 'group', title: 'أُضيف زرّ تغيير الموعد', body: '', link: undefined, roles: ['teacher'], section: 'all', target: undefined }

describe('messageError', () => {
  it('يقبل مجموعةً بعنوانٍ وفئةٍ وقسم', () => {
    expect(messageError(group)).toBeNull()
  })

  it('يرفض العنوانَ الفارغ والطويل والنصَّ الطويل', () => {
    expect(messageError({ ...group, title: '  ' })).toBe('اكتب عنوانَ الرسالة.')
    expect(messageError({ ...group, title: 'ا'.repeat(121) })).toContain('120')
    expect(messageError({ ...group, body: 'ا'.repeat(601) })).toContain('600')
  })

  it('يطلب فئةً وقسماً للمجموعة، وشخصاً للفرد', () => {
    expect(messageError({ ...group, roles: [] })).toBe('اختر فئةً واحدةً على الأقلّ.')
    expect(messageError({ ...group, section: undefined })).toBe('اختر القسم.')
    expect(messageError({ ...group, mode: 'person' })).toBe('اختر مَن تصله الرسالة.')
    expect(messageError({ ...group, mode: 'person', roles: [], target: 'x' })).toBeNull()
  })
})

describe('seenCount', () => {
  it('يعدّ من شاهد وحدَه', () => {
    expect(seenCount({ reads: [{ seen_at: '2026-10-25T10:00:00Z' }, { seen_at: null }, { seen_at: '2026-10-25T11:00:00Z' }] })).toBe(2)
  })
})

describe('audienceLabel', () => {
  it('يصوغ الفئاتِ بالمؤنّث لقسم البنات', () => {
    expect(audienceLabel(['teacher', 'field_supervisor'], 'female')).toBe('المعلّمات والمشرفات الميدانيات · قسم البنات')
  })

  it('يفصل بالفاصلة ثم الواو', () => {
    expect(audienceLabel(['teacher', 'field_supervisor', 'examiner'], 'all')).toBe('المعلّمون، المشرفون الميدانيون والمختبِرون · القسمان')
  })
})
