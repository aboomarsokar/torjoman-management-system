/**
 * خيارات طاقم الحلقة في نموذجها: المعلمون والمشرفون الميدانيون والمختبِرون من جنس الحلقة وحدَه،
 * ولا قائمة قبل اختيار الجنس. والمعلم المُسنَد لحلقةٍ نشطة أخرى لا يُعرض (لكل معلم حلقة واحدة).
 * الحكم الأخير لحارس القاعدة `guard_halaqa_staff` — هذه طبقة تجربة تمنع الخطأ قبل وقوعه.
 */
import type { Ref } from 'vue'
import type { Database } from '~/types/database.types'

type Gender = Database['public']['Enums']['gender_type']

/** قيمة «بلا مشرف / بلا مختبِر» في القوائم (القاعدة تخزّنها null). */
export const NO_STAFF = 'none'

export interface StaffRow { id: string, full_name: string, gender: Gender | null }
export interface HalaqaLoad { id: string, teacher_id: string, status: string }

/** الطاقم من جنسٍ بعينه؛ ولا أحد قبل اختيار الجنس. */
export function staffOfGender<T extends StaffRow>(rows: T[], gender: Gender | ''): T[] {
  return gender ? rows.filter(r => r.gender === gender) : []
}

/**
 * المعلمون المتاحون: من جنس الحلقة، وغيرُ مُسنَدين لحلقةٍ نشطة أخرى.
 * `keepId` معلمُ الحلقة المعدَّلة نفسها — يبقى ظاهراً كي لا يُفرَّغ اختيارٌ قائم.
 */
export function availableTeachers(
  teachers: StaffRow[], halqat: HalaqaLoad[], gender: Gender | '', editingId: string | null, keepId: string | null
): StaffRow[] {
  const busy = new Set(halqat.filter(h => h.status === 'active' && h.id !== editingId).map(h => h.teacher_id))
  return staffOfGender(teachers, gender).filter(t => t.id === keepId || !busy.has(t.id))
}

/** المختبِر المقترح: الوحيد النشط من جنس الحلقة، وإلا «بلا مختبِر». */
export function suggestedExaminer(examiners: StaffRow[], gender: Gender | ''): string {
  const exact = staffOfGender(examiners, gender)
  return exact.length === 1 ? exact[0]!.id : NO_STAFF
}

export interface StaffSelection { teacher_id: string, supervisor_id: string, examiner_id: string }

/** بعد تغيير الجنس: يُسقط كلَّ مختارٍ من الجنس الآخر، ويقترح المختبِر حين يفرغ. */
export function reconcileStaff(
  sel: StaffSelection, gender: Gender | '', lists: { teachers: StaffRow[], supervisors: StaffRow[], examiners: StaffRow[] }
): StaffSelection {
  // قائمةٌ فارغة = لم تصل بعد (أو لا أحد أصلاً) — فلا يُفرَّغ اختيارٌ قائم على ظنّ
  const fits = (rows: StaffRow[], id: string) => rows.length === 0 || rows.some(r => r.id === id && r.gender === gender)
  const examinerKept = sel.examiner_id !== NO_STAFF && fits(lists.examiners, sel.examiner_id)
  return {
    teacher_id: fits(lists.teachers, sel.teacher_id) ? sel.teacher_id : '',
    supervisor_id: sel.supervisor_id !== NO_STAFF && fits(lists.supervisors, sel.supervisor_id) ? sel.supervisor_id : NO_STAFF,
    examiner_id: examinerKept ? sel.examiner_id : suggestedExaminer(lists.examiners, gender)
  }
}

async function fetchStaff(role: 'teacher' | 'field_supervisor' | 'examiner'): Promise<StaffRow[]> {
  const supabase = useSupabaseClient<Database>()
  const { data } = await supabase.from('profiles').select('id, full_name, gender')
    .eq('role', role).eq('status', 'active').order('full_name')
  return data ?? []
}

/** قوائم النموذج الثلاث مربوطةً بجنس الحلقة، مع تصحيح الاختيار عند تغيّره. */
export function useHalaqaStaffOptions(
  form: StaffSelection & { gender: Gender | '' },
  halqat: Ref<HalaqaLoad[] | null | undefined>,
  editingId: Ref<string | null>
) {
  const opts = { server: false, default: () => [] as StaffRow[] }
  const { data: teachers } = useLazyAsyncData('halaqa-teacher-options', () => fetchStaff('teacher'), opts)
  const { data: supervisors } = useLazyAsyncData('halaqa-supervisor-options', () => fetchStaff('field_supervisor'), opts)
  const { data: examiners } = useLazyAsyncData('halaqa-examiner-options', () => fetchStaff('examiner'), opts)

  const keepId = computed(() => (halqat.value ?? []).find(h => h.id === editingId.value)?.teacher_id ?? null)
  const toItem = (r: StaffRow) => ({ label: r.full_name, value: r.id })

  const teacherItems = computed(() =>
    availableTeachers(teachers.value ?? [], halqat.value ?? [], form.gender, editingId.value, keepId.value).map(toItem))
  const supervisorItems = computed(() =>
    [{ label: 'بلا مشرف', value: NO_STAFF }, ...staffOfGender(supervisors.value ?? [], form.gender).map(toItem)])
  const examinerItems = computed(() =>
    [{ label: 'بلا مختبِر', value: NO_STAFF }, ...staffOfGender(examiners.value ?? [], form.gender).map(toItem)])

  watch(() => form.gender, (g) => {
    Object.assign(form, reconcileStaff(form, g, {
      teachers: teachers.value ?? [], supervisors: supervisors.value ?? [], examiners: examiners.value ?? []
    }))
  })

  return { teacherItems, supervisorItems, examinerItems }
}
