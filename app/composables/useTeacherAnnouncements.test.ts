import { describe, expect, it } from 'vitest'
import { announcementError } from './useTeacherAnnouncements'

const ok = { title: 'أُضيفت ميزةُ طلب الملازم', body: '', link: undefined, audience: 'all' as const }

describe('announcementError', () => {
  it('يقبل عنواناً وجمهوراً بلا نصٍّ ولا رابط', () => {
    expect(announcementError(ok)).toBeNull()
  })

  it('يرفض العنوانَ الفارغ ولو بمسافات', () => {
    expect(announcementError({ ...ok, title: '   ' })).toBe('اكتب عنوانَ الإشعار.')
  })

  it('يرفض العنوانَ الطويل والنصَّ الطويل', () => {
    expect(announcementError({ ...ok, title: 'ا'.repeat(121) })).toContain('120')
    expect(announcementError({ ...ok, body: 'ا'.repeat(401) })).toContain('400')
  })

  it('يطلب الجمهور', () => {
    expect(announcementError({ ...ok, audience: undefined })).toBe('اختر مَن يصلهم الإشعار.')
  })
})
