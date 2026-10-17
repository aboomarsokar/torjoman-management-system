import { describe, expect, it } from 'vitest'
import { STAFF_EMAIL_DOMAIN, STUDENT_EMAIL_DOMAIN, staffEmailFromNumber, studentEmailFromIdentity } from './accounts'

describe('البريد الداخلي', () => {
  it('نطاقان مختلفان تحت torjoman.org', () => {
    expect(STAFF_EMAIL_DOMAIN).toBe('staff.torjoman.org')
    expect(STUDENT_EMAIL_DOMAIN).toBe('students.torjoman.org')
  })
  it('يبنيان من الرقم بعد التطبيع', () => {
    expect(staffEmailFromNumber('١٠٠١')).toBe('1001@staff.torjoman.org')
    expect(studentEmailFromIdentity(' ٤٠٧٧٠٦٩٥١ ')).toBe('407706951@students.torjoman.org')
  })
})
