<script setup lang="ts">
/**
 * ملفُّ المرشّح (طلب المستخدم 2026-10-30): بياناتُه، وموعدُ مقابلته ولجنتُه، وتقييماتُ اللجنة بالمتوسّط وتفصيل البنود،
 * ونسخُ رسالة الدعوة وإرسالُها SMS، والتقييمُ بالعلامات والقرارُ وإبلاغُ النتيجة وإنشاءُ الحساب للمدير الإداريّ وحده
 * (`CandidatesDecision`)؛ والنتيجةُ تُحسب من تقييمه تلقائياً (2026-10-31).
 */
import type { Candidate } from '~/composables/useCandidates'
import { CANDIDATE_CRITERIA, CANDIDATE_PASS_MARK, CRITERION_MAX, CANDIDATE_STATUS_COLOR, CANDIDATE_STATUS_LABEL, type CandidateStatus } from '~/constants/candidates'
import { averageScore, criterionAverages, eligibilityIssues, interviewWhen, inviteMessage, weightedScore } from '~/utils/candidates'

interface Props {
  candidate: Candidate | null
  names: Record<string, string>
  me: string | null
  canManage: boolean
  isAdmin: boolean
  busy: boolean
}
const props = defineProps<Props>()
const emit = defineEmits<{ evaluate: [], schedule: [], sms: [], resultSms: [], decide: [status: CandidateStatus, note: string], hire: [], remove: [] }>()
const open = defineModel<boolean>('open', { required: true })
const toast = useToast()

const avg = computed(() => props.candidate ? averageScore(props.candidate.evaluations) : null)
const perCriterion = computed(() => props.candidate ? criterionAverages(props.candidate.evaluations) : [])
// التقييمُ بالعلامات للمدير الإداريّ وحده (2026-10-31 — واللجنةُ على الورق)، ويُعاد بعد النتيجة فتُحسب من جديد
const canEvaluate = computed(() => !!props.candidate && !!props.me && props.isAdmin
  && ['invited', 'interviewed', 'accepted', 'reserve', 'rejected'].includes(props.candidate.status))
const mine = computed(() => !!props.me && !!props.candidate?.evaluations.some(e => e.evaluator_id === props.me))
const when = interviewWhen
const yesNo = (v: boolean | null) => v === null ? '—' : v ? 'نعم' : 'لا'
const facts = computed(() => {
  const c = props.candidate
  if (!c) return []
  return [
    ['الهوية', c.national_id], ['الجوال', c.phone], ['الجنس', c.gender === 'female' ? 'أنثى' : 'ذكر'],
    ['الأجزاء المحفوظة', c.quran_parts ?? '—'], ['التجويد', c.tajweed_level ?? '—'], ['سنوات الخبرة', c.experience_years ?? '—'],
    ['السكن', c.residence ?? '—'], ['منطقة الحلقة', c.halaqa_area ?? '—'], ['المسجد أو المصلّى', c.nearest_mosque ?? '—'],
    ['العنوان', c.address_detail ?? '—'], ['يجمع 15 طالباً', yesNo(c.can_gather)], ['يتفرّغ ساعتين يومياً', yesNo(c.daily_commitment)],
    ['المؤهل', c.education ?? '—']
  ] as [string, string | number][]
})
const issues = computed(() => props.candidate ? eligibilityIssues(props.candidate) : [])

async function copyInvite() {
  const c = props.candidate
  if (!c?.interview_at) return
  const text = inviteMessage(c.full_name, c.gender, when(c.interview_at), c.interview_place)
  try {
    await navigator.clipboard.writeText(text)
    toast.add({ title: 'نُسخت رسالة الدعوة.', color: 'success', icon: 'i-lucide-copy-check' })
  } catch {
    toast.add({ title: 'تعذّر النسخ — انسخها يدوياً.', description: text, color: 'warning' })
  }
}
</script>

<template>
  <USlideover
    v-model:open="open"
    side="left"
    :title="candidate?.full_name ?? ''"
    :ui="{ content: 'max-w-xl' }"
  >
    <template #body>
      <div
        v-if="candidate"
        class="cd"
      >
        <div class="cd-head">
          <UBadge
            :label="CANDIDATE_STATUS_LABEL[candidate.status]"
            :color="CANDIDATE_STATUS_COLOR[candidate.status]"
            variant="soft"
          />
          <span
            v-if="avg !== null"
            class="cd-score"
            :class="{ pass: avg >= CANDIDATE_PASS_MARK }"
          ><b dir="ltr">{{ avg }}</b> / 100<template v-if="candidate.decision_manual"> · عُدّلت النتيجة يدوياً</template></span>
        </div>

        <div
          v-if="issues.length"
          class="cd-flag"
          role="note"
        >
          <b><UIcon
            name="i-lucide-triangle-alert"
            class="size-4"
          />لا تنطبق عليه الشروط</b>
          <span>{{ issues.join('، ') }}</span>
        </div>
        <dl class="cd-facts">
          <div
            v-for="[k, v] in facts"
            :key="k"
          >
            <dt>{{ k }}</dt><dd>{{ v }}</dd>
          </div>
        </dl>
        <p
          v-if="candidate.experience"
          class="cd-text"
        >
          <b>الخبرة:</b> {{ candidate.experience }}
        </p>
        <p
          v-if="candidate.about"
          class="cd-text"
        >
          <b>إضافة:</b> {{ candidate.about }}
        </p>

        <section class="cd-sec">
          <h3>المقابلة</h3>
          <p v-if="candidate.interview_at">
            {{ when(candidate.interview_at) }}<template v-if="candidate.interview_place">
              · {{ candidate.interview_place }}
            </template>
          </p>
          <p
            v-else
            class="muted"
          >
            لم تُحدَّد بعد.
          </p>
          <p
            v-if="candidate.committee.length"
            class="muted"
          >
            اللجنة: {{ candidate.committee.map(id => names[id] ?? '—').join('، ') }}
          </p>
          <p
            v-if="candidate.invite_sms_at"
            class="cd-sent"
          >
            <UIcon
              name="i-lucide-message-square-check"
              class="size-4"
            />أُرسلت رسالة الدعوة SMS · {{ when(candidate.invite_sms_at) }}
          </p>
          <div class="cd-actions">
            <UButton
              v-if="canManage && ['new', 'invited', 'reserve'].includes(candidate.status)"
              :label="candidate.interview_at ? 'عدّل الموعد واللجنة' : 'ادعُه للمقابلة'"
              icon="i-lucide-calendar-plus"
              color="primary"
              variant="soft"
              :ui="{ base: 'rounded-[12px] min-h-11' }"
              @click="emit('schedule')"
            />
            <UButton
              v-if="candidate.status === 'invited' && candidate.interview_at && isAdmin"
              :label="candidate.invite_sms_at ? 'أعد إرسال الدعوة SMS' : 'أرسل الدعوة SMS'"
              icon="i-lucide-message-square-text"
              color="primary"
              variant="soft"
              :loading="busy"
              :ui="{ base: 'rounded-[12px] min-h-11' }"
              @click="emit('sms')"
            />
            <UButton
              v-if="candidate.interview_at && canManage"
              label="انسخ رسالة الدعوة"
              icon="i-lucide-copy"
              color="neutral"
              variant="soft"
              :ui="{ base: 'rounded-[12px] min-h-11' }"
              @click="copyInvite"
            />
            <UButton
              v-if="canEvaluate"
              :label="mine ? 'عدّل التقييم' : 'قيّم المرشّح'"
              icon="i-lucide-clipboard-pen"
              color="primary"
              :ui="{ base: 'rounded-[12px] min-h-11 font-semibold' }"
              @click="emit('evaluate')"
            />
          </div>
        </section>

        <section
          v-if="candidate.evaluations.length"
          class="cd-sec"
        >
          <h3>تقييمات اللجنة</h3>
          <ul class="cd-evals">
            <li
              v-for="e in candidate.evaluations"
              :key="e.evaluator_id"
            >
              <span>{{ names[e.evaluator_id] ?? '—' }}</span><b dir="ltr">{{ weightedScore(e.scores) }}</b>
              <small v-if="e.notes">{{ e.notes }}</small>
            </li>
          </ul>
          <table class="cd-crit">
            <tbody>
              <tr
                v-for="(c, i) in CANDIDATE_CRITERIA"
                :key="c.key"
              >
                <th>{{ c.label }}</th>
                <td dir="ltr">
                  {{ perCriterion[i] ?? '—' }} / {{ CRITERION_MAX }}
                </td>
              </tr>
            </tbody>
          </table>
        </section>

        <CandidatesDecision
          v-if="isAdmin"
          :candidate="candidate"
          :busy="busy"
          @decide="(s: CandidateStatus, n: string) => emit('decide', s, n)"
          @result-sms="emit('resultSms')"
          @hire="emit('hire')"
          @remove="emit('remove')"
        />
      </div>
    </template>
  </USlideover>
</template>

<style scoped>
.cd { display: flex; flex-direction: column; gap: 18px; }
.cd-head { display: flex; align-items: center; justify-content: space-between; gap: 10px; flex-wrap: wrap; }
.cd-score { color: var(--ink-3); font-size: 13px; }
.cd-score b { font-size: 22px; color: var(--err); font-variant-numeric: tabular-nums; }
.cd-score.pass b { color: var(--green-ink); }
.cd-flag { display: flex; flex-direction: column; gap: 2px; padding: 10px 14px; border-radius: 12px; background: var(--err-soft); color: var(--err); font-size: 13.5px; }
.cd-flag b { display: inline-flex; align-items: center; gap: 6px; font-weight: 700; }
.cd-facts { margin: 0; display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 10px 16px; }
.cd-facts dt { font-size: 12px; color: var(--ink-3); }
.cd-facts dd { margin: 0; font-weight: 600; color: var(--ink); font-variant-numeric: tabular-nums; overflow-wrap: anywhere; }
.cd-text { margin: 0; color: var(--ink-2); line-height: 1.8; white-space: pre-line; }
.cd-sec { display: flex; flex-direction: column; gap: 8px; padding-top: 16px; border-top: 1px solid var(--line); }
.cd-sec h3 { margin: 0; font-size: 15px; font-weight: 700; color: var(--ink); }
.cd-sec p { margin: 0; color: var(--ink-2); }
.cd-sent { display: inline-flex; align-items: center; gap: 6px; color: var(--green-ink) !important; font-size: 13.5px; font-weight: 600; }
.muted { color: var(--ink-3) !important; font-size: 13.5px; }
.cd-actions { display: flex; flex-wrap: wrap; gap: 8px; }
.cd-evals { list-style: none; margin: 0; padding: 0; display: flex; flex-direction: column; gap: 6px; }
.cd-evals li { display: grid; grid-template-columns: 1fr auto; gap: 2px 10px; padding: 8px 12px; border-radius: 10px; background: var(--surface-3); }
.cd-evals b { font-variant-numeric: tabular-nums; color: var(--ink); }
.cd-evals small { grid-column: 1 / -1; color: var(--ink-2); }
.cd-crit { width: 100%; border-collapse: collapse; font-size: 13.5px; }
.cd-crit th { text-align: start; font-weight: 500; color: var(--ink-2); padding: 5px 0; border-bottom: 1px solid var(--line); }
.cd-crit td { text-align: end; font-variant-numeric: tabular-nums; color: var(--ink); border-bottom: 1px solid var(--line); }
</style>
