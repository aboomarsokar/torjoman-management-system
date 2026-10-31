/**
 * متابعةُ صور الهويات (طلب المستخدم 2026-10-31) — المديرُ الإداريّ (الكادرُ كلُّه) والمديرةُ الإدارية (عاملاتُ قسم البنات):
 * العاملون النشطون (لا الطلاب) وحالةُ صورة كلٍّ منهم، وفتحُ صورةٍ، وتنزيلُ صورةٍ أو المحدَّدين أو الكلّ في ملفٍّ مضغوطٍ
 * بأسمائهم، وتذكيرُ من لم يرفع برسالة إدارةٍ تصل جرسه. ما يُرى يحكمه RLS (`private.can_view_id_card`).
 */
import type { Database } from '~/types/database.types'
import type { IdCardRow } from '~/composables/useIdCard'
import { ID_CARD_BUCKET, SIGNED_URL_SECONDS } from '~/constants/library'
import { idCardExt, idCardZipName } from '~/utils/library'

export interface StaffIdRow {
  id: string
  full_name: string
  employee_number: string | null
  role: string
  gender: 'male' | 'female'
  card: IdCardRow | null
}

/** أدوارٌ تصلها رسائلُ الإدارة (`send_staff_message`) — والمديرون يُذكَّرون مباشرةً. */
const MESSAGE_ROLES = ['teacher', 'field_supervisor', 'examiner']

/** من لم يرفع وتصله رسالةُ التذكير. */
export const remindableIds = (rows: StaffIdRow[]) => rows.filter(r => !r.card && MESSAGE_ROLES.includes(r.role)).map(r => r.id)

export function useIdCards() {
  const supabase = useSupabaseClient<Database>()
  const { handle } = useErrorHandler()
  const toast = useToast()
  const rows = ref<StaffIdRow[]>([])
  const loading = ref(false)
  const busy = ref(false)

  /** `femaleOnly` للمديرة الإدارية: عاملاتُ قسمها وحدهنّ. */
  async function load(femaleOnly: boolean) {
    loading.value = true
    let q = supabase.from('profiles').select('id, full_name, employee_number, role, gender')
      .eq('status', 'active').neq('role', 'student').order('full_name')
    if (femaleOnly) q = q.eq('gender', 'female')
    const [{ data: people, error }, { data: cards, error: cErr }] = await Promise.all([q, supabase.from('staff_id_cards').select('*')])
    loading.value = false
    if (error || cErr) {
      handle(error ?? cErr)
      return
    }
    const byId = new Map((cards ?? []).map(c => [c.profile_id, c]))
    rows.value = (people ?? []).map(p => ({ ...p, gender: p.gender as 'male' | 'female', card: byId.get(p.id) ?? null }))
  }

  async function view(row: StaffIdRow) {
    if (!row.card) return
    const { data, error } = await supabase.storage.from(ID_CARD_BUCKET).createSignedUrl(row.card.file_path, SIGNED_URL_SECONDS)
    if (error || !data) {
      handle(error ?? new Error('تعذّر فتح الصورة.'))
      return
    }
    window.open(data.signedUrl, '_blank', 'noopener')
  }

  /** صورةٌ واحدة تُنزَّل كما هي، وأكثرُ في ملفٍّ مضغوطٍ واحد بأسماء أصحابها. */
  async function download(list: StaffIdRow[]) {
    const withCard = list.filter(r => r.card)
    if (!withCard.length) {
      toast.add({ title: 'لا صورَ هويةٍ مرفوعة بين المحدّدين.', color: 'warning', icon: 'i-lucide-info' })
      return
    }
    busy.value = true
    try {
      const taken = new Set<string>()
      const named = withCard.map(r => ({ r, name: idCardZipName(r.employee_number, r.full_name, idCardExt(r.card!.mime_type) ?? 'jpg', taken) }))
      const files = await Promise.all(named.map(async ({ r, name }) => {
        const { data, error } = await supabase.storage.from(ID_CARD_BUCKET).download(r.card!.file_path)
        if (error || !data) throw error ?? new Error('تعذّر تنزيل صورة.')
        return { name, blob: data }
      }))
      let blob: Blob
      let fileName: string
      if (files.length === 1) {
        blob = files[0]!.blob
        fileName = files[0]!.name
      } else {
        const { default: JSZip } = await import('jszip')
        const zip = new JSZip()
        for (const f of files) zip.file(f.name, f.blob)
        blob = await zip.generateAsync({ type: 'blob' })
        fileName = `صور الهويات (${files.length}).zip`
      }
      const url = URL.createObjectURL(blob)
      const a = Object.assign(document.createElement('a'), { href: url, download: fileName })
      a.click()
      setTimeout(() => URL.revokeObjectURL(url), 10_000)
    } catch (err) {
      handle(err, 'تعذّر تنزيل صور الهويات.')
    } finally {
      busy.value = false
    }
  }

  /** رسالةُ إدارةٍ لكلّ من لم يرفع، ورابطُها صفحةُ «حسابي» حيث خانةُ الهوية. */
  async function remind(ids: string[]) {
    if (!ids.length) return
    busy.value = true
    let sent = 0
    try {
      for (const id of ids) {
        const { error } = await supabase.rpc('send_staff_message', {
          p_title: 'ارفع صورة هويتك', p_body: 'نرجو رفع صورة واضحة لهويتك من صفحة «حسابي» في المنصة.',
          // الدالّةُ تقبل null للمجموعة حين يُرسَل لشخص (والأنواعُ المولّدة لا تعرف ذلك)
          p_link: '/profile/me', p_roles: null as unknown as string[], p_section: null as unknown as string, p_target: id
        })
        if (error) throw error
        sent++
      }
    } catch (err) {
      handle(err, 'تعذّر إرسال التذكير للجميع.')
    } finally {
      busy.value = false
    }
    if (sent) toast.add({ title: `أُرسل التذكير إلى ${sent}.`, color: 'success', icon: 'i-lucide-bell-ring' })
  }

  return { rows, loading, busy, load, view, download, remind }
}
