/**
 * نسخةُ طلاب المعلّم على الجهاز (البند 14، 2026-10-27): صفوفُ طلاب حلقته كاملةً بكلّ حالاتهم — لتبويب «الطلاب» بلا
 * إنترنت (`/t/students`). تُقرأ بلا شبكة، وتُحدَّث متّصلاً (عند فتح الشاشة وعند فتح لوحة المعلّم).
 */
import type { Database } from '~/types/database.types'
import { idbGet, idbPut } from '~/utils/offlineDb'
import { studentsMirrorKey, type StudentsMirror } from '~/utils/studentsMirror'

export function useStudentsMirror() {
  const supabase = useSupabaseClient<Database>()
  const mirror = ref<StudentsMirror | null>(null)
  const refreshing = ref(false)

  /** نسخةُ هذا المعلّم — أو آخرِ معلّمٍ فتح شاشاتِه إن لم تُعرف الجلسة. */
  async function loadLocal(uid: string | null): Promise<StudentsMirror | null> {
    const id = uid ?? await idbGet<string>('meta', 'current') ?? null
    mirror.value = id ? (await idbGet<StudentsMirror>('meta', studentsMirrorKey(id))) ?? null : null
    return mirror.value
  }

  /** يحدّث النسخةَ من القاعدة ويحفظها — يرمي عند الفشل (يبقى المحفوظ). */
  async function refresh(uid: string): Promise<StudentsMirror> {
    refreshing.value = true
    try {
      const { data: halaqa, error } = await supabase.from('halaqat').select('id, name, daily_time')
        .eq('teacher_id', uid).eq('status', 'active').limit(1).maybeSingle()
      if (error) throw error
      let students: StudentsMirror['students'] = []
      if (halaqa) {
        const res = await supabase.from('students').select('*').eq('halaqa_id', halaqa.id).order('full_name')
        if (res.error) throw res.error
        students = res.data ?? []
      }
      const next: StudentsMirror = { uid, halaqa: halaqa ?? null, students, syncedAt: new Date().toISOString() }
      await idbPut('meta', next, studentsMirrorKey(uid))
      await idbPut('meta', uid, 'current')
      mirror.value = next
      return next
    } finally {
      refreshing.value = false
    }
  }

  return { mirror, refreshing, loadLocal, refresh }
}
