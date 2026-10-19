import type { Database } from '~/types/database.types'
import type { MushafPage } from '~/utils/quran/mushaf'
import type { ProgramJuz } from '~/utils/quran/position'

/**
 * مراجعُ القرآن في العميل: السورُ وفهرسُ صفحات المصحف وأجزاءُ البرنامج.
 * جداولُ صغيرةٌ ثابتة فتُجلب مرّةً واحدةً للجلسة وتُحفظ في `useState` (طلبٌ واحد لكلٍّ منها).
 */
export interface SurahRef { number: number, name: string, ayahCount: number }

type ProgramJuzRow = Database['public']['Tables']['program_juz']['Row']

/** صفوفُ `program_juz` ← أجزاءُ الموضع بترتيب الحفظ (الجزء 30 أولاً ثم 29 … 1)؛ لا تغيّر المدخلات. */
export function toProgramJuz(rows: Pick<ProgramJuzRow, 'number' | 'start_surah' | 'start_ayah' | 'end_surah' | 'end_ayah'>[]): ProgramJuz[] {
  return rows
    .map(r => ({
      number: r.number,
      start: { surah: r.start_surah, ayah: r.start_ayah },
      end: { surah: r.end_surah, ayah: r.end_ayah }
    }))
    .sort((a, b) => b.number - a.number)
}

/** التحميلُ الجاري (إن تزامن استدعاءان لا يُطلب الجدول مرّتين). على العميل وحده، يُفرَّغ عند الانتهاء. */
let inflight: Promise<void> | null = null

export function useQuranReference() {
  const supabase = useSupabaseClient<Database>()
  const { handle } = useErrorHandler()
  const surahs = useState<SurahRef[]>('quran-ref-surahs', () => [])
  const pages = useState<MushafPage[]>('quran-ref-pages', () => [])
  const juz = useState<ProgramJuz[]>('quran-ref-juz', () => [])
  const ready = useState<boolean>('quran-ref-ready', () => false)

  async function fetchAll() {
    const [s, p, j] = await Promise.all([
      supabase.from('surahs').select('number, name, ayah_count').order('number'),
      supabase.from('quran_pages').select('page, surah, ayah').order('page'),
      supabase.from('program_juz').select('number, start_surah, start_ayah, end_surah, end_ayah')
    ])
    const failure = s.error ?? p.error ?? j.error
    if (failure) throw failure
    surahs.value = (s.data ?? []).map(r => ({ number: r.number, name: r.name, ayahCount: r.ayah_count }))
    pages.value = p.data ?? []
    juz.value = toProgramJuz(j.data ?? [])
    ready.value = true
  }

  /** يجلب الجداول الثلاثة مرّةً واحدة؛ الاستدعاءاتُ اللاحقة بعد النجاح لا تطلب شيئاً، وبعد الفشل تعيد المحاولة. */
  async function load(): Promise<void> {
    if (ready.value) return
    inflight ??= fetchAll()
      .catch((err) => { handle(err) })
      .finally(() => { inflight = null })
    await inflight
  }

  /** عددُ آيات السورة؛ 0 إن لم تُحمَّل المراجع بعد. */
  function ayahCountOf(n: number): number {
    return surahs.value.find(s => s.number === n)?.ayahCount ?? 0
  }

  /** اسمُ السورة؛ نصٌّ فارغ إن لم تُحمَّل المراجع بعد. */
  function surahName(n: number): string {
    return surahs.value.find(s => s.number === n)?.name ?? ''
  }

  return { surahs, pages, juz, ready, load, ayahCountOf, surahName }
}
