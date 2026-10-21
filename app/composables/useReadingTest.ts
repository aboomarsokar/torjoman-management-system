/**
 * اختبارُ القراءة للطالب — يبدأ بـ`start_reading_test()` (أو يستأنف المفتوح) فتصله الأسئلةُ بلا إجابات،
 * ويسلّم بـ`submit_reading_test()` فيُصحَّح في القاعدة. الإجاباتُ تُحفظ في الجلسة (sessionStorage) فلا يضيع
 * ما أجاب إن انقطعت الشبكة أو أُعيد تحميل الصفحة؛ وعند انتهاء الوقت يُسلَّم تلقائياً.
 * الحسابُ النقيّ (الوقت والعدّ وتحويل الإجابات) مُصدَّرٌ ومختبَر.
 */
import type { Database } from '~/types/database.types'

export interface TestOption { k: number, text: string }
export interface TestQuestion { id: number, body: string, options: TestOption[] }
export interface TestPayload {
  attempt_id: string
  unit_id: number
  unit_title: string
  unit_order: number
  deadline_at: string
  total: number
  questions: TestQuestion[]
}
export interface TestResult { score: number, total: number, percent: number, passed: boolean, unit_id: number }
export type TestPhase = 'intro' | 'loading' | 'test' | 'submitting' | 'result' | 'error'

/** الثواني الباقية (لا أقلّ من صفر). */
export function secondsLeft(deadlineIso: string, nowMs: number): number {
  return Math.max(0, Math.ceil((new Date(deadlineIso).getTime() - nowMs) / 1000))
}

/** «MM:SS». */
export function formatClock(seconds: number): string {
  const m = Math.floor(seconds / 60)
  const s = seconds % 60
  return `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`
}

/** الأسئلةُ التي لم يُجب عنها. */
export function unansweredCount(questions: TestQuestion[], answers: Record<number, number>): number {
  return questions.filter(q => answers[q.id] === undefined).length
}

/** الإجاباتُ بشكل الدالّة: `{ "<رقم السؤال>": "<مفتاح الخيار>" }`. */
export function toAnswerPayload(answers: Record<number, number>): Record<string, string> {
  return Object.fromEntries(Object.entries(answers).map(([q, k]) => [q, String(k)]))
}

const storageKey = (attemptId: string) => `reading-answers-${attemptId}`

function loadAnswers(attemptId: string): Record<number, number> {
  try {
    const raw = sessionStorage.getItem(storageKey(attemptId))
    return raw ? JSON.parse(raw) as Record<number, number> : {}
  } catch {
    return {}
  }
}

function saveAnswers(attemptId: string, answers: Record<number, number>) {
  try {
    sessionStorage.setItem(storageKey(attemptId), JSON.stringify(answers))
  } catch {
    // التخزينُ ممنوعٌ (نافذةٌ خاصّة) — تبقى الإجاباتُ في الذاكرة وتُسلَّم عادياً
  }
}

export function useReadingTest() {
  const supabase = useSupabaseClient<Database>()
  const { handle } = useErrorHandler()

  const phase = ref<TestPhase>('intro')
  const payload = ref<TestPayload | null>(null)
  const answers = reactive<Record<number, number>>({})
  const result = ref<TestResult | null>(null)
  const errorMessage = ref('')
  const now = ref(Date.now())
  let timer: ReturnType<typeof setInterval> | null = null

  const remaining = computed(() => (payload.value ? secondsLeft(payload.value.deadline_at, now.value) : 0))
  const unanswered = computed(() => (payload.value ? unansweredCount(payload.value.questions, answers) : 0))

  function stopTimer() {
    if (timer) clearInterval(timer)
    timer = null
  }

  async function start() {
    phase.value = 'loading'
    const { data, error } = await supabase.rpc('start_reading_test')
    if (error || !data) {
      errorMessage.value = handle(error, 'تعذّر بدء الاختبار. حاول مجدداً.')
      phase.value = 'error'
      return
    }
    payload.value = data as unknown as TestPayload
    Object.assign(answers, loadAnswers(payload.value.attempt_id))
    phase.value = 'test'
    now.value = Date.now()
    timer = setInterval(() => {
      now.value = Date.now()
      if (remaining.value === 0 && phase.value === 'test') void submit()
    }, 1000)
  }

  function choose(questionId: number, k: number) {
    answers[questionId] = k
    if (payload.value) saveAnswers(payload.value.attempt_id, { ...answers })
  }

  async function submit() {
    if (!payload.value || phase.value === 'submitting') return
    phase.value = 'submitting'
    const { data, error } = await supabase.rpc('submit_reading_test', {
      p_attempt: payload.value.attempt_id,
      p_answers: toAnswerPayload(answers)
    })
    if (error || !data) {
      handle(error, 'تعذّر تسليم الاختبار — إجاباتك محفوظة، حاول التسليم مجدداً.')
      phase.value = 'test'
      return
    }
    stopTimer()
    try {
      sessionStorage.removeItem(storageKey(payload.value.attempt_id))
    } catch {
      // لا يهمّ — المحاولةُ خُتمت في القاعدة
    }
    result.value = data as unknown as TestResult
    phase.value = 'result'
  }

  onBeforeUnmount(stopTimer)

  return { phase, payload, answers, result, errorMessage, remaining, unanswered, start, choose, submit }
}
