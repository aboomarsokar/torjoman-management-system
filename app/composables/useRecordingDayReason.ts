import type { Database } from '~/types/database.types'
import { dayReasonText, type ReasonState } from '~/utils/recordingStatus'

/**
 * سببُ يومٍ في تفصيل «متابعة الرصد» (بلاغ «لم تنعقد» 2026-10-30): يُقرأ عند فتح اليوم لا مع الشبكة كلِّها.
 * الإجازةُ من `attendance_holidays` (يوم)، والبلاغُ من `attendance_off_days` (حلقة + يوم، والنطاقُ بـRLS). يردّ النصَّ
 * الجاهز للعرض (`dayReasonText`)، والفشلُ يرتفع إلى المستدعي ليعرضه بـ`useErrorHandler`.
 */
export function useRecordingDayReason() {
  const supabase = useSupabaseClient<Database>()

  async function read(state: ReasonState, halaqaId: string, day: string, female: boolean): Promise<string> {
    if (state === 'holiday') {
      const { data, error } = await supabase.from('attendance_holidays').select('reason').eq('day', day).maybeSingle()
      if (error) throw error
      return dayReasonText(state, { reason: data?.reason ?? null }, female)
    }
    const { data, error } = await supabase.from('attendance_off_days').select('reason, note').eq('halaqa_id', halaqaId).eq('day', day).maybeSingle()
    if (error) throw error
    return dayReasonText(state, { reason: data?.reason ?? null, note: data?.note ?? null }, female)
  }

  return { read }
}
