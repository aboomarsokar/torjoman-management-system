import { describe, expect, it } from 'vitest'
import { ALL_ROLES, remindableIds, roleKey, roleOptions, type StaffIdRow } from './useIdCards'

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

describe('roleOptions — فلتر الدور بالدور والجنس', () => {
  const p = (id: string, role: string, gender: 'male' | 'female'): StaffIdRow => ({ id, full_name: id, employee_number: null, role, gender, card: null })
  it('معلم ومعلمة شريحتان، الأكثرُ أولاً، و«كل الأدوار» في المقدّمة', () => {
    const rows = [p('a', 'teacher', 'male'), p('b', 'teacher', 'female'), p('c', 'teacher', 'female'), p('d', 'examiner', 'male')]
    expect(roleOptions(rows)).toEqual([
      { value: ALL_ROLES, label: 'كل الأدوار', count: 4 },
      { value: 'teacher:female', label: 'معلمة', count: 2 },
      { value: 'examiner:male', label: 'مختبِر', count: 1 },
      { value: 'teacher:male', label: 'معلم', count: 1 }
    ])
    expect(roleKey(rows[0]!)).toBe('teacher:male')
  })
})
