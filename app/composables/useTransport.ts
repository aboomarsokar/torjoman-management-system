import type { Database } from '~/types/database.types'
import { TRANSPORT_LOGGER_ROLES } from '~/constants/transport'
import { monthBounds, type Trip } from '~/utils/transport'

/**
 * الوصولُ إلى رحلات المواصلات (جدول `transport_trips`): جلبُ شهرٍ، وحفظُ رحلةٍ وحذفُها، والتسديد.
 * كلُّ فشلٍ يُرمى `Error` برسالةٍ عربية. تحديثٌ أو حذفٌ لم يمسّ صفّاً (RLS: سُدّدت الرحلة بين الحين والآخر)
 * ليس نجاحاً. الإدراجُ بلا `profile_id` فالافتراضيّ `auth.uid()`.
 */
export interface TripInput {
  id?: string
  trip_date: string
  description: string
  amount: number
  notes: string | null
}

const COLUMNS = 'id, profile_id, trip_date, description, amount, notes, paid, paid_at, created_at'

export function useTransport() {
  const supabase = useSupabaseClient<Database>()

  /** رحلاتُ الشهر مرتّبةً بالتاريخ ثم وقت الإنشاء؛ و`profileId` يحصرها في موظفٍ بعينه. */
  async function fetchMonth(year: number, month: number, opts: { profileId?: string } = {}): Promise<Trip[]> {
    const { from, to } = monthBounds(year, month)
    let query = supabase.from('transport_trips').select(COLUMNS)
      .gte('trip_date', from).lt('trip_date', to)
      .order('trip_date').order('created_at')
    if (opts.profileId) query = query.eq('profile_id', opts.profileId)
    const { data, error } = await query
    if (error) throw error
    return (data ?? []).map(r => ({ ...r, amount: Number(r.amount) }))
  }

  /** إضافةُ رحلة (بلا `id`) أو تعديلُ غير المسدَّدة (بـ`id`). */
  async function saveTrip(input: TripInput): Promise<void> {
    const body = { trip_date: input.trip_date, description: input.description, amount: input.amount, notes: input.notes }
    if (!input.id) {
      const { error } = await supabase.from('transport_trips').insert(body)
      if (error) throw error
      return
    }
    const { data, error } = await supabase.from('transport_trips').update(body).eq('id', input.id).select('id')
    if (error) throw error
    if (!data?.length) throw new Error('لم يُحفظ — قد تكون الرحلةُ سُدّدت.')
  }

  /** حذفُ رحلةٍ غير مسدَّدة. */
  async function deleteTrip(id: string): Promise<void> {
    const { data, error } = await supabase.from('transport_trips').delete().eq('id', id).select('id')
    if (error) throw error
    if (!data?.length) throw new Error('لم تُحذف — قد تكون الرحلةُ سُدّدت.')
  }

  /** تسديدٌ أو إلغاءُ تسديدٍ جماعيّ (للمدير الإداري)؛ يُرجع عددَ الرحلات التي تغيّرت. */
  async function setPaid(ids: string[], paid: boolean): Promise<number> {
    const { data, error } = await supabase.rpc('set_transport_paid', { p_ids: ids, p_paid: paid })
    if (error) throw error
    return data ?? 0
  }

  /** من يُدخلون رحلات (المشرفون الميدانيون والمختبِرون الفعّالون) مرتّبين بالاسم. */
  async function fetchLoggers(): Promise<{ id: string, full_name: string }[]> {
    const { data, error } = await supabase.from('profiles').select('id, full_name')
      .in('role', [...TRANSPORT_LOGGER_ROLES]).eq('status', 'active').order('full_name')
    if (error) throw error
    return data ?? []
  }

  return { fetchMonth, saveTrip, deleteTrip, setPaid, fetchLoggers }
}
