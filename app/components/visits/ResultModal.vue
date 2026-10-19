<script setup lang="ts">
/**
 * نتيجةُ الزيارة: المشرفُ صاحبها يرفعها (يومُ التنفيذ الفعليّ والتقييم والملاحظات)، والإدارةُ تطّلع.
 * يومُ التنفيذ يُختار (كان لحظةَ الحفظ، فمن رفع نتيجته في الغد سُجّل متأخّراً)، والقاعدةُ تشتقّ الحالة:
 * في يوم الموعد أو قبله = في وقتها، وبعده = متأخّرة. ويظهر سجلُّ تغييرات الموعد وأسبابُها للجميع.
 */
import type { Database } from '~/types/database.types'
import type { VisitRow } from '~/types/visits'

interface Props {
  open: boolean
  visit: VisitRow | null
  /** المشرف الميداني صاحب الزيارة — يحفظ؛ غيره يطّلع. */
  canEdit: boolean
}
const props = defineProps<Props>()
const emit = defineEmits<{ 'update:open': [boolean], 'saved': [] }>()

const supabase = useSupabaseClient<Database>()
const { handle } = useErrorHandler()
const toast = useToast()

const ratingItems = ['ممتاز', 'جيد جداً', 'جيد', 'يحتاج تحسين'].map(r => ({ label: r, value: r }))
const result = reactive({ executed_day: '', flow_rating: '', strengths: '', improvements: '', recommendations: '', notes: '' })
const saving = ref(false)
type LogRow = { id: string, old_time: string | null, new_time: string | null, reason: string, changed_at: string }
const log = ref<LogRow[]>([])
const today = ref(gazaToday())

watch(() => [props.open, props.visit?.id] as const, async ([open]) => {
  const v = props.visit
  if (!open || !v) return
  today.value = gazaToday()
  result.executed_day = v.executed_at ? gazaDayOf(v.executed_at) : props.canEdit ? today.value : ''
  result.flow_rating = v.flow_rating ?? 'ممتاز'
  result.strengths = v.strengths ?? ''
  result.improvements = v.improvements ?? ''
  result.recommendations = v.recommendations ?? ''
  result.notes = v.notes ?? ''
  log.value = []
  const { data, error } = await supabase.from('visit_reschedule_log')
    .select('id, old_time, new_time, reason, changed_at').eq('visit_id', v.id).order('changed_at')
  if (error) handle(error)
  else log.value = data ?? []
}, { immediate: true })

/** حقولُ النتيجة تظهر لصاحبها، ولغيره متى رُفعت. */
const hasResult = computed(() => props.canEdit || !!props.visit?.executed_at)
const scheduledDay = computed(() => (props.visit ? gazaDayOf(props.visit.scheduled_at) : ''))
/** ما ستُسجَّل به الزيارة لو حُفظ اليومُ المختار — يراه المشرف قبل الحفظ. */
const outcome = computed(() => {
  if (!result.executed_day) return null
  return result.executed_day <= scheduledDay.value ? VISIT_STATUS.done : VISIT_STATUS.late
})

async function save() {
  if (!props.visit) return
  if (!result.executed_day || result.executed_day > today.value) {
    toast.add({ title: 'اختر يوم التنفيذ (لا يتجاوز اليوم).', color: 'warning', icon: 'i-lucide-info' })
    return
  }
  saving.value = true
  try {
    const { data, error } = await supabase.from('supervision_visits').update({
      executed_at: executedAtFromDay(result.executed_day),
      flow_rating: result.flow_rating || null,
      strengths: result.strengths.trim() || null,
      improvements: result.improvements.trim() || null,
      recommendations: result.recommendations.trim() || null,
      notes: result.notes.trim() || null
    }).eq('id', props.visit.id).select('id')
    if (error) throw error
    if (!data?.length) throw new Error('لم يُحفظ التغيير — هذه الزيارة ليست ضمن صلاحيتك.')
    toast.add({ title: 'تم رفع نتيجة الزيارة.', color: 'success', icon: 'i-lucide-circle-check' })
    emit('update:open', false)
    emit('saved')
  } catch (err) {
    handle(err)
  } finally {
    saving.value = false
  }
}
</script>

<template>
  <UModal
    :open="open"
    :title="`نتيجة زيارة ${visit?.halaqa?.name || ''}`"
    @update:open="(v: boolean) => emit('update:open', v)"
  >
    <template #body>
      <div class="form">
        <div
          v-if="visit"
          class="when"
        >
          <span>الموعد المجدول <b dir="ltr">{{ formatVisitMoment(visit.scheduled_at) }}</b></span>
          <span v-if="visit.supervisor">الزائر <b>{{ visit.supervisor.full_name }}</b></span>
        </div>

        <p
          v-if="!hasResult"
          class="pending"
        >
          لم تُرفع نتيجة هذه الزيارة بعد.
        </p>
        <template v-else>
          <UFormField
            label="يوم التنفيذ الفعلي"
            :help="canEdit ? 'في يوم الموعد أو قبله = في وقتها، وبعده = متأخّرة.' : undefined"
          >
            <div class="exec-day">
              <input
                v-model="result.executed_day"
                type="date"
                :max="today"
                :disabled="!canEdit"
                class="date-input"
                dir="ltr"
              >
              <UBadge
                v-if="outcome && (canEdit || visit?.executed_at)"
                :label="outcome.label"
                :color="outcome.color"
                variant="soft"
              />
            </div>
          </UFormField>
          <UFormField label="تقييم سير الحلقة">
            <USelect
              v-model="result.flow_rating"
              :items="ratingItems"
              :disabled="!canEdit"
              size="lg"
              class="w-full"
              :ui="{ base: 'rounded-[13px]' }"
            />
          </UFormField>
          <UFormField
            v-for="f in ([['strengths', 'نقاط القوة'], ['improvements', 'جوانب التحسين'], ['recommendations', 'التوصيات'], ['notes', 'ملاحظات إضافية']] as const)"
            :key="f[0]"
            :label="f[1]"
          >
            <UTextarea
              v-model="result[f[0]]"
              :rows="2"
              :disabled="!canEdit"
              size="lg"
              class="w-full"
              :ui="{ base: 'rounded-[13px]' }"
            />
          </UFormField>
        </template>

        <section
          v-if="log.length"
          class="log"
        >
          <h3>تغييرات الموعد ({{ log.length }})</h3>
          <ul>
            <li
              v-for="l in log"
              :key="l.id"
            >
              <span
                class="log-times"
                dir="ltr"
              >{{ l.old_time ? formatVisitMoment(l.old_time) : '—' }} → {{ l.new_time ? formatVisitMoment(l.new_time) : '—' }}</span>
              <span class="log-reason">{{ l.reason }}</span>
            </li>
          </ul>
        </section>

        <div class="form-actions">
          <UButton
            label="إغلاق"
            color="neutral"
            variant="ghost"
            size="lg"
            :ui="{ base: 'rounded-[13px]' }"
            @click="emit('update:open', false)"
          />
          <UButton
            v-if="canEdit"
            label="حفظ النتيجة"
            color="primary"
            size="lg"
            icon="i-lucide-check"
            :loading="saving"
            :ui="{ base: 'rounded-[13px] font-semibold' }"
            @click="save"
          />
        </div>
      </div>
    </template>
  </UModal>
</template>

<style scoped>
.form { display: flex; flex-direction: column; gap: 14px; }
.form-actions { display: flex; justify-content: flex-end; gap: 10px; margin-top: 6px; }
.when { display: flex; flex-wrap: wrap; gap: 6px 18px; padding: 12px 14px; border-radius: 13px; background: var(--surface-2); color: var(--ink-3); font-size: 13.5px; }
.when b { color: var(--ink); font-weight: 600; margin-inline-start: 4px; }
.exec-day { display: flex; align-items: center; gap: 10px; flex-wrap: wrap; }
.date-input { height: 44px; padding: 0 12px; border-radius: 13px; border: 1px solid var(--line-2); background: var(--surface-2); color: var(--ink); font-size: 15px; outline: none; }
.date-input:focus { border-color: var(--blue); box-shadow: 0 0 0 3px var(--ring); }
.date-input:disabled { opacity: .7; }
.pending { margin: 0; padding: 14px; border-radius: 13px; background: var(--surface-2); color: var(--ink-2); font-size: 14px; text-align: center; }
.log h3 { margin: 4px 0 8px; font-size: 14.5px; font-weight: 700; color: var(--ink); }
.log ul { list-style: none; margin: 0; padding: 0; }
.log li { display: flex; flex-direction: column; gap: 3px; padding: 10px 0; }
.log li + li { border-top: 1px solid var(--line); }
.log-times { font-size: 12.5px; color: var(--ink-3); text-align: end; align-self: flex-start; font-variant-numeric: tabular-nums; }
.log-reason { color: var(--ink); font-size: 14px; overflow-wrap: anywhere; }
</style>
