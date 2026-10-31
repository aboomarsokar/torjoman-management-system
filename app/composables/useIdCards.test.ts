import { describe, expect, it } from 'vitest'
import { remindableIds, type StaffIdRow } from './useIdCards'

const row = (id: string, role: string, card: boolean): StaffIdRow => ({
  id, full_name: id, employee_number: null, role, gender: 'male',
  card: card ? { profile_id: id, file_path: `${id}/x.jpg`, mime_type: 'image/jpeg', size_bytes: 1, uploaded_at: '' } : null
})

describe('remindableIds — من يُذكَّر برفع هويته', () => {
  it('من لم يرفع من المعلّمين والمشرفين والمختبِرين وحدهم', () => {
    const rows = [row('a', 'teacher', false), row('b', 'teacher', true), row('c', 'examiner', false), row('d', 'technical_manager', false)]
    expect(remindableIds(rows)).toEqual(['a', 'c'])
  })
})
