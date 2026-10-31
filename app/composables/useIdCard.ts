/**
 * صورةُ هويتي (طلب المستخدم 2026-10-31): العاملُ يرفع صورةً واحدةً لهويته ويستبدلها ويفتحها. الصورةُ تُصغَّر على
 * الجهاز قبل الرفع (أطولُ ضلعٍ 1600) فتبقى أرقامُها مقروءةً وحجمُها صغيراً، والـPDF يُرفع كما هو حتى 5 م.ب.
 * كلُّ رفعٍ باسمٍ جديد ثم يُحذف القديمُ بعد نجاح الصفّ.
 */
import type { Database } from '~/types/database.types'
import { ID_CARD_BUCKET, ID_CARD_JPEG_QUALITY, ID_CARD_MAX_BYTES, ID_CARD_MAX_SIDE, SIGNED_URL_SECONDS } from '~/constants/library'
import { idCardExt, idCardFileError } from '~/utils/library'
import { shrinkToFit } from '~/utils/imageFit'

export type IdCardRow = Database['public']['Tables']['staff_id_cards']['Row']

export function useIdCard(profileId: Ref<string>) {
  const supabase = useSupabaseClient<Database>()
  const { handle } = useErrorHandler()
  const toast = useToast()
  const card = ref<IdCardRow | null>(null)
  const busy = ref(false)

  async function load() {
    if (!profileId.value) return
    const { data, error } = await supabase.from('staff_id_cards').select('*').eq('profile_id', profileId.value).maybeSingle()
    if (error) {
      handle(error)
      return
    }
    card.value = data
  }

  async function upload(file: File): Promise<boolean> {
    const problem = idCardFileError(file)
    if (problem) {
      toast.add({ title: problem, color: 'warning', icon: 'i-lucide-circle-alert' })
      return false
    }
    busy.value = true
    try {
      const isPdf = file.type === 'application/pdf'
      const blob = isPdf ? file : await shrinkToFit(file, ID_CARD_MAX_SIDE, ID_CARD_JPEG_QUALITY)
      if (blob.size > ID_CARD_MAX_BYTES) throw new Error('الصورة كبيرةٌ حتى بعد التصغير — صوّر الهوية وحدها بلا خلفيةٍ واسعة.')
      const mime = isPdf ? 'application/pdf' : 'image/jpeg'
      const path = `${profileId.value}/${crypto.randomUUID()}.${idCardExt(mime)}`
      const { error: upErr } = await supabase.storage.from(ID_CARD_BUCKET).upload(path, blob, { contentType: mime })
      if (upErr) throw upErr
      const old = card.value?.file_path
      const { error } = await supabase.from('staff_id_cards')
        .upsert({ profile_id: profileId.value, file_path: path, mime_type: mime, size_bytes: blob.size, uploaded_at: new Date().toISOString() })
      if (error) {
        await supabase.storage.from(ID_CARD_BUCKET).remove([path])
        throw error
      }
      if (old) await supabase.storage.from(ID_CARD_BUCKET).remove([old])
      toast.add({ title: 'رُفعت صورة الهوية.', color: 'success', icon: 'i-lucide-circle-check' })
      await load()
      return true
    } catch (err) {
      handle(err)
      return false
    } finally {
      busy.value = false
    }
  }

  async function view() {
    if (!card.value) return
    const { data, error } = await supabase.storage.from(ID_CARD_BUCKET).createSignedUrl(card.value.file_path, SIGNED_URL_SECONDS)
    if (error || !data) {
      handle(error ?? new Error('تعذّر فتح الصورة.'))
      return
    }
    window.open(data.signedUrl, '_blank', 'noopener')
  }

  return { card, busy, load, upload, view }
}
