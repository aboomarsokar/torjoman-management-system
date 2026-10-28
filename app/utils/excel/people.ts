/**
 * أوراقُ الأشخاص والحلقات للتصدير (طلب المستخدم 2026-10-28): العاملون، والطلاب، والحلقات — صفوفٌ عربيةٌ جاهزة.
 * منطقٌ صرفٌ مختبَر؛ الجلبُ في useDataExport.
 */
import type { Database } from '~/types/database.types'
import { GENDER_LABELS, HALAQA_STATUS_LABELS, STUDENT_STATUS_LABELS, USER_STATUS_LABELS } from '~/constants/dataExport'
import { roleLabel } from '~/constants/roles'
import { formatHalaqaTime } from '~/utils/time'
import type { SheetSpec } from './workbook'

type Tables = Database['public']['Tables']
export type ProfileRow = Tables['profiles']['Row']
export type StudentRow = Tables['students']['Row']
export type HalaqaRow = Tables['halaqat']['Row']

/** «28/10/2026» من `YYYY-MM-DD` أو طابعٍ زمنيّ، والفارغُ فارغ. */
export function dmy(value: string | null | undefined): string {
  if (!value) return ''
  const [y, m, d] = value.slice(0, 10).split('-')
  return y && m && d ? `${Number(d)}/${Number(m)}/${y}` : ''
}

/** «حلقةُ أ، حلقةُ ب» — أسماءُ الحلقات التي يحمل فيها الموظفُ دوراً. */
function halaqatOf(halaqat: HalaqaRow[], id: string, key: 'teacher_id' | 'supervisor_id' | 'examiner_id'): string {
  return halaqat.filter(h => h[key] === id).map(h => h.name).join('، ')
}

export function staffSheet(staff: ProfileRow[], halaqat: HalaqaRow[]): SheetSpec {
  return {
    name: 'العاملون',
    columns: [
      { header: 'الرقم الوظيفي', key: 'emp', width: 12 }, { header: 'الاسم', key: 'name', width: 30 },
      { header: 'الدور', key: 'role', width: 16 }, { header: 'الجنس', key: 'gender', width: 8 },
      { header: 'الحالة', key: 'status', width: 9 }, { header: 'الجوال', key: 'phone', width: 13 },
      { header: 'واتساب', key: 'whatsapp', width: 13 }, { header: 'رقم الهوية', key: 'nid', width: 12 },
      { header: 'تاريخ الميلاد', key: 'birth', width: 12 }, { header: 'المسمّى الوظيفي', key: 'job', width: 16 },
      { header: 'تاريخ التعيين', key: 'hire', width: 12 }, { header: 'سنوات الخبرة', key: 'exp', width: 10 },
      { header: 'المؤهّل', key: 'edu', width: 14 }, { header: 'التخصّص', key: 'major', width: 16 },
      { header: 'الأجزاء المحفوظة', key: 'parts', width: 10 }, { header: 'مستوى التجويد', key: 'tajweed', width: 12 },
      { header: 'الحالة الاجتماعية', key: 'marital', width: 12 }, { header: 'عدد الأسرة', key: 'family', width: 9 },
      { header: 'منطقة السكن', key: 'area', width: 16 }, { header: 'أقرب مسجد', key: 'mosque', width: 16 },
      { header: 'العنوان', key: 'address', width: 22 },
      { header: 'معلّمٌ في', key: 'teaches', width: 24 }, { header: 'مشرفٌ على', key: 'supervises', width: 30 },
      { header: 'مختبِرٌ في', key: 'examines', width: 30 }
    ],
    rows: staff.map(p => ({
      emp: p.employee_number, name: p.full_name, role: roleLabel(p.role, p.gender), gender: GENDER_LABELS[p.gender ?? ''] ?? '',
      status: USER_STATUS_LABELS[p.status] ?? p.status, phone: p.phone, whatsapp: p.whatsapp, nid: p.national_id,
      birth: dmy(p.birth_date), job: p.job_title, hire: dmy(p.hire_date), exp: p.years_experience,
      edu: p.education_level, major: p.academic_major, parts: p.quran_parts, tajweed: p.tajweed_level,
      marital: p.marital_status, family: p.family_count, area: p.residence_area, mosque: p.nearest_mosque, address: p.address_detail,
      teaches: halaqatOf(halaqat, p.id, 'teacher_id'), supervises: halaqatOf(halaqat, p.id, 'supervisor_id'),
      examines: halaqatOf(halaqat, p.id, 'examiner_id')
    }))
  }
}

export function studentsSheet(students: StudentRow[], halaqat: HalaqaRow[], names: Map<string, string>): SheetSpec {
  const byId = new Map(halaqat.map(h => [h.id, h]))
  return {
    name: 'الطلاب',
    columns: [
      { header: 'الاسم', key: 'name', width: 30 }, { header: 'رقم الهوية', key: 'nid', width: 12 },
      { header: 'الجنس', key: 'gender', width: 8 }, { header: 'تاريخ الميلاد', key: 'birth', width: 12 },
      { header: 'الحالة', key: 'status', width: 9 }, { header: 'الحلقة', key: 'halaqa', width: 22 },
      { header: 'المعلّم', key: 'teacher', width: 26 }, { header: 'جوال الطالب', key: 'phone', width: 13 },
      { header: 'وليّ الأمر', key: 'guardian', width: 22 }, { header: 'جوال وليّ الأمر', key: 'gphone', width: 13 },
      { header: 'بريد وليّ الأمر', key: 'gemail', width: 22 }, { header: 'السكن', key: 'residence', width: 16 },
      { header: 'أقرب مسجد', key: 'mosque', width: 16 }, { header: 'مستوى التجويد', key: 'tajweed', width: 12 },
      { header: 'الأجزاء المحفوظة', key: 'parts', width: 10 }, { header: 'عدد الأسرة', key: 'family', width: 9 },
      { header: 'تاريخ الالتحاق', key: 'enrolled', width: 12 }, { header: 'له حساب', key: 'account', width: 8 }
    ],
    rows: students.map((s) => {
      const h = s.halaqa_id ? byId.get(s.halaqa_id) : undefined
      return {
        name: s.full_name, nid: s.national_id, gender: GENDER_LABELS[s.gender ?? ''] ?? '', birth: dmy(s.birth_date),
        status: STUDENT_STATUS_LABELS[s.status] ?? s.status, halaqa: h?.name ?? '', teacher: h?.teacher_id ? names.get(h.teacher_id) ?? '' : '',
        phone: s.phone, guardian: s.guardian_name, gphone: s.guardian_phone, gemail: s.guardian_email,
        residence: s.residence, mosque: s.nearest_mosque, tajweed: s.tajweed_level, parts: s.quran_parts, family: s.family_count,
        enrolled: dmy(s.enrollment_date), account: s.user_id ? 'نعم' : 'لا'
      }
    })
  }
}

export function halaqatSheet(halaqat: HalaqaRow[], names: Map<string, string>, students: StudentRow[]): SheetSpec {
  const count = (id: string) => students.filter(s => s.halaqa_id === id && s.status === 'active').length
  const name = (id: string | null) => (id ? names.get(id) ?? '' : '')
  return {
    name: 'الحلقات',
    columns: [
      { header: 'الحلقة', key: 'name', width: 24 }, { header: 'القسم', key: 'section', width: 8 },
      { header: 'الحالة', key: 'status', width: 9 }, { header: 'الموعد', key: 'time', width: 18 },
      { header: 'المعلّم', key: 'teacher', width: 26 }, { header: 'المشرف', key: 'supervisor', width: 26 },
      { header: 'المختبِر', key: 'examiner', width: 26 }, { header: 'عدد الطلاب', key: 'students', width: 10 }
    ],
    rows: halaqat.map(h => ({
      name: h.name, section: h.gender === 'female' ? 'البنات' : 'البنين', status: HALAQA_STATUS_LABELS[h.status] ?? h.status,
      time: formatHalaqaTime(h.daily_time), teacher: name(h.teacher_id), supervisor: name(h.supervisor_id),
      examiner: name(h.examiner_id), students: count(h.id)
    }))
  }
}
