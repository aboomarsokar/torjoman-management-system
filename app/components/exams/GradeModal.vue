<script setup lang="ts">
/**
 * نافذة رصد نتيجة الاختبار (§4.10) — كل سؤال بتفريعاته (حفظ/فهم/تدبّر) + التجويد،
 * كل خانة من 10 والتجويد من 7 إلى 9، والمجموع من 99. تُعرض دورةُ البند ونطاقُها وحدودُها.
 * تحفظ في exam_results وتُصدر saved للتحديث؛ والرصدُ المكرَّر (23505) يُعرض برسالةٍ عربيّة.
 */
import type { Database } from '~/types/database.types'
import { gradeErrorMessage } from '~/utils/exams/nomination'
import { gazaToday } from '~/utils/reportWindow'
import { EXAM_MAX_TOTAL, EXAM_SCORE_STEP } from '~/constants/exams'

/** البندُ المرصود: معرّفُه وطالبُه، ونصُّ هدفه (الدورة أو نطاقُ الخطة القديمة) وحدودُه. */
type GradeTarget = {
  id: string
  student: { id: string, full_name: string } | null
  title?: string
  detail?: string
  span?: string
}

/** أعلى مجموعٍ ممكن: تسعةُ أسئلةٍ من 10 + التجويد حتى 9. */
const MAX_TOTAL = EXAM_MAX_TOTAL

const props = defineProps<{ target: GradeTarget | null }>()
const emit = defineEmits<{ saved: [] }>()
const open = defineModel<boolean>('open', { default: false })

const supabase = useSupabaseClient<Database>()
const { profile } = useProfile()
const { handle } = useErrorHandler()
const toast = useToast()

const { data: passMark } = useLazyAsyncData<number>('exams-passmark', async () => {
  const { data } = await supabase.from('app_settings').select('pass_mark').eq('id', 1).single()
  return data?.pass_mark ?? 80
}, { server: false, default: () => 80 })

const scores = reactive({
  q1_memorization: '', q1_understanding: '', q1_reflection: '',
  q2_memorization: '', q2_understanding: '', q2_reflection: '',
  q3_memorization: '', q3_understanding: '', q3_reflection: '',
  tajweed_score: '', notes: ''
})
type ScoreKey = 'q1_memorization' | 'q1_understanding' | 'q1_reflection'
  | 'q2_memorization' | 'q2_understanding' | 'q2_reflection'
  | 'q3_memorization' | 'q3_understanding' | 'q3_reflection' | 'tajweed_score'

const scoreKeys: ScoreKey[] = [
  'q1_memorization', 'q1_understanding', 'q1_reflection',
  'q2_memorization', 'q2_understanding', 'q2_reflection',
  'q3_memorization', 'q3_understanding', 'q3_reflection', 'tajweed_score'
]

// مجموعات العرض: كل سؤال بتفريعاته منفصلاً (حفظ/فهم/تدبّر) + التجويد
const BRANCH: Record<string, string> = { memorization: 'الحفظ', understanding: 'الفهم', reflection: 'التدبّر' }
const branchLabel = (key: ScoreKey) => key === 'tajweed_score' ? 'الدرجة (من 7 إلى 9)' : (BRANCH[key.split('_')[1] ?? ''] ?? key)
const scoreGroups: { title: string, keys: ScoreKey[] }[] = [
  { title: 'السؤال الأول', keys: ['q1_memorization', 'q1_understanding', 'q1_reflection'] },
  { title: 'السؤال الثاني', keys: ['q2_memorization', 'q2_understanding', 'q2_reflection'] },
  { title: 'السؤال الثالث', keys: ['q3_memorization', 'q3_understanding', 'q3_reflection'] },
  { title: 'التجويد', keys: ['tajweed_score'] }
]

// التجويد من 7 إلى 9 (قرار 2026-10-19؛ القاعدة تحرسه أيضاً). لا يُرفع إلى 7 أثناء الكتابة —
// يُفحص عند الحفظ وتُعلَّم الخانة ما دامت خارج الحدّ.
const TAJWEED_MIN = 7
const TAJWEED_MAX = 9
const minFor = (key: ScoreKey) => key === 'tajweed_score' ? TAJWEED_MIN : 0
const maxFor = (key: ScoreKey) => key === 'tajweed_score' ? TAJWEED_MAX : 10
const tajweedInvalid = computed(() => {
  const n = Number(scores.tajweed_score)
  return scores.tajweed_score === '' || Number.isNaN(n) || n < TAJWEED_MIN || n > TAJWEED_MAX
})

// حدّ كل فرع 10 (لا يقبل النظام أكثر). لا تُعاد كتابةُ الخانة إلا خارج الحدّ، كي لا تُمسح النقطة
// أثناء كتابة «9.5»؛ والتقريبُ إلى أقرب نصف عند الحفظ (roundToStep)
function clampScore(key: ScoreKey) {
  const raw = scores[key]
  if (raw === '') return
  const n = Number(raw)
  if (Number.isNaN(n)) return
  if (n > maxFor(key)) scores[key] = String(maxFor(key))
  else if (n < 0) scores[key] = '0'
}
/** أقربُ مضاعفٍ لخطوة الرصد (نصف درجة) — القاعدة ترفض غيره (`exam_results_half_steps`). */
const roundToStep = (n: number) => Math.round(n / EXAM_SCORE_STEP) * EXAM_SCORE_STEP

const liveTotal = computed(() => scoreKeys.reduce((sum, k) => sum + (Number(scores[k]) || 0), 0))

// تفريغ الخانات عند كل فتح
watch(open, (v) => {
  if (!v) return
  for (const k of scoreKeys) scores[k] = ''
  scores.notes = ''
})

const grading = ref(false)
async function saveGrade() {
  if (!props.target?.student) return
  if (tajweedInvalid.value) {
    toast.add({ title: `درجة التجويد من ${TAJWEED_MIN} إلى ${TAJWEED_MAX}.`, color: 'error', icon: 'i-lucide-circle-alert' })
    return
  }
  grading.value = true
  try {
    const sc = (k: ScoreKey) => roundToStep(Math.min(maxFor(k), Math.max(0, Number(scores[k]) || 0)))
    const payload = {
      student_id: props.target.student.id,
      exam_list_item_id: props.target.id,
      examiner_id: profile.value?.id ?? null,
      // تُهمله القاعدة وتضع قيمةَ الإعدادات (مُشغّل exam_results_guard_pass_mark)؛ الحقلُ مطلوبٌ في نوع Insert المولَّد
      pass_mark_snapshot: passMark.value ?? 80,
      exam_date: gazaToday(),
      q1_memorization: sc('q1_memorization'),
      q1_understanding: sc('q1_understanding'),
      q1_reflection: sc('q1_reflection'),
      q2_memorization: sc('q2_memorization'),
      q2_understanding: sc('q2_understanding'),
      q2_reflection: sc('q2_reflection'),
      q3_memorization: sc('q3_memorization'),
      q3_understanding: sc('q3_understanding'),
      q3_reflection: sc('q3_reflection'),
      tajweed_score: sc('tajweed_score'),
      notes: scores.notes.trim() || null
    }
    // عند الاجتياز يرفع مُشغِّل القاعدة (bump_parts_on_pass) الأجزاءَ المثبتة إلى
    // نهاية نطاق المحطة — فلا يحتاج الراصد (المختبِر) صلاحية تعديل الطلاب.
    const { error } = await supabase.from('exam_results').insert(payload)
    if (error) throw error

    toast.add({ title: 'تم رصد النتيجة.', color: 'success', icon: 'i-lucide-circle-check' })
    open.value = false
    emit('saved')
  } catch (err) {
    const known = gradeErrorMessage(err)
    handle(known ? new Error(known) : err)
  } finally {
    grading.value = false
  }
}
</script>

<template>
  <UModal
    v-model:open="open"
    :title="`رصد نتيجة: ${target?.student?.full_name || ''}`"
  >
    <template #body>
      <div class="grade">
        <div
          v-if="target?.title"
          class="grade-target"
        >
          <strong>{{ target.title }}</strong>
          <span v-if="target.detail">{{ target.detail }}</span>
          <span v-if="target.span">{{ target.span }}</span>
        </div>
        <p class="grade-hint">
          كل خانة من 10، والتجويد بين 7 و9 (المجموع من {{ MAX_TOTAL }}). علامة الاجتياز: <strong>{{ passMark }}</strong>.
        </p>
        <div class="groups">
          <div
            v-for="g in scoreGroups"
            :key="g.title"
            class="qgroup"
            :class="{ single: g.keys.length === 1 }"
          >
            <div class="qgroup-title">
              {{ g.title }}
            </div>
            <div class="qgroup-fields">
              <div
                v-for="k in g.keys"
                :key="k"
                class="qfield"
              >
                <label class="qfield-label">{{ branchLabel(k) }}</label>
                <input
                  v-model="scores[k]"
                  type="number"
                  :min="minFor(k)"
                  :max="maxFor(k)"
                  :step="EXAM_SCORE_STEP"
                  inputmode="decimal"
                  dir="ltr"
                  class="qfield-input"
                  :class="{ invalid: k === 'tajweed_score' && scores[k] !== '' && tajweedInvalid }"
                  :aria-invalid="k === 'tajweed_score' && scores[k] !== '' && tajweedInvalid"
                  @input="clampScore(k)"
                >
                <span class="qfield-of">/{{ maxFor(k) }}</span>
              </div>
            </div>
          </div>
        </div>
        <div
          class="total"
          :class="{ ok: liveTotal >= (passMark || 80) }"
        >
          المجموع: <strong>{{ liveTotal }}</strong> / {{ MAX_TOTAL }}
          <span class="pill">{{ liveTotal >= (passMark || 80) ? 'مجتاز' : 'غير مجتاز' }}</span>
        </div>
        <UFormField label="ملاحظات (اختياري)">
          <UTextarea
            v-model="scores.notes"
            :rows="2"
            size="lg"
            class="w-full"
            :ui="{ base: 'rounded-[13px]' }"
          />
        </UFormField>
        <div class="form-actions">
          <UButton
            label="إلغاء"
            color="neutral"
            variant="ghost"
            size="lg"
            :ui="{ base: 'rounded-[13px]' }"
            @click="open = false"
          />
          <UButton
            label="حفظ النتيجة"
            color="primary"
            size="lg"
            icon="i-lucide-check"
            :loading="grading"
            :ui="{ base: 'rounded-[13px] font-semibold' }"
            @click="saveGrade"
          />
        </div>
      </div>
    </template>
  </UModal>
</template>

<style scoped>
.grade { display: flex; flex-direction: column; gap: 16px; }
.grade-hint { margin: 0; font-size: 14px; color: var(--ink-2); }
.grade-target { display: flex; flex-direction: column; gap: 2px; padding: 12px 16px; border-radius: 13px; background: var(--blue-soft); color: var(--blue-ink); font-size: 13.5px; }
.grade-target strong { font-size: 15px; }
.groups { display: flex; flex-direction: column; gap: 14px; }
.qgroup { background: var(--surface-2); border: 1px solid var(--line); border-radius: 15px; padding: 14px 16px; }
.qgroup-title { font-size: 14px; font-weight: 700; color: var(--ink); margin-bottom: 12px; }
.qgroup-fields { display: grid; grid-template-columns: repeat(3, 1fr); gap: 12px; }
.qgroup.single .qgroup-fields { grid-template-columns: 1fr; max-width: 240px; }
.qfield { display: flex; flex-direction: column; gap: 6px; position: relative; }
.qfield-label { font-size: 13px; color: var(--ink-2); font-weight: 600; }
.qfield-input { width: 100%; height: 52px; padding: 0 14px; border-radius: 12px; border: 1.5px solid var(--line-2); background: var(--surface); color: var(--ink); font-size: 20px; font-weight: 700; text-align: center; outline: none; font-variant-numeric: tabular-nums; }
.qfield-input:focus { border-color: var(--blue); box-shadow: 0 0 0 3px var(--ring); }
.qfield-input.invalid { border-color: var(--err); }
.qfield-of { position: absolute; inset-inline-end: 12px; bottom: 15px; font-size: 12px; color: var(--ink-3); pointer-events: none; }
.total { display: flex; align-items: center; gap: 10px; font-size: 16px; color: var(--ink-2); padding: 12px 16px; border-radius: 13px; background: var(--surface-2); border: 1px solid var(--line); }
.total strong { font-size: 22px; color: var(--ink); }
.total .pill { margin-inline-start: auto; height: 28px; padding: 0 12px; display: inline-flex; align-items: center; border-radius: 999px; background: var(--err-soft); color: var(--err); font-size: 13px; font-weight: 700; }
.total.ok .pill { background: var(--green-soft); color: var(--green-ink); }
.form-actions { display: flex; justify-content: flex-end; gap: 10px; }

@media (max-width: 560px) { .qgroup-fields { grid-template-columns: 1fr 1fr; } }
</style>
