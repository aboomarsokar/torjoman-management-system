<script setup lang="ts">
/**
 * نتيجةُ الزيارة بنموذج الزيارة الإشرافية (قرارات المستخدم 2026-10-21):
 * - المشرفُ صاحبها يختار يومَ التنفيذ ويعدّ مرّاتِ بنود الخصم (`VisitsEvaluationForm`) ويكتب ملاحظاتِه وتوجيهاتِه،
 *   و**الحفظُ يُقفلها عليه** (القاعدة: `visit_score_and_lock`)؛ والمجموعُ من 42 تحسبه القاعدة.
 * - المديرُ الإداري والفنيّ يفتحان المقفلةَ للتعديل (`unlock_visit_result`) فيصحّح المشرف ويحفظ فتُقفل ثانيةً.
 * - المعلمُ يرى نتيجةَ حلقته ويُقرّ بالاطّلاع (`acknowledge_visit`) بدل التوقيع.
 * - الزيارةُ القديمة (قبل النموذج، بلا `deductions`) تُعرض بحقولها القديمة للقراءة.
 * ويظهر سجلُّ تغييرات الموعد وأسبابُها للجميع (`VisitsRescheduleLog`، وبلا اتصال يُخفى).
 * المشرفُ الميداني بلا اتصال (الدفعة الثالثة — 2026-10-29): الحفظُ يذهب إلى صندوق جهازه (`useVisitOffline`)، والزيارةُ
 * المحفوظةُ على الجهاز تُفتح للقراءة بعدّه وملاحظاته ويومه (الصفُّ يصل مطبَّقاً عليه سطرُه) وتحمل شارةَ «بانتظار الرفع».
 */
import { PROJECT_START_DATE } from '~/constants/project'
import type { Database } from '~/types/database.types'
import type { VisitRow } from '~/types/visits'
import type { DeductionCounts } from '~/utils/visitForm'
import { cleanCounts, parseCounts } from '~/utils/visitForm'
import { ACK_SAVED_MESSAGE } from '~/composables/useOfflineAck'
import { PENDING_UPLOAD_BADGE, VISIT_SAVED_ON_DEVICE } from '~/composables/useVisitOffline'
import { queueOnline as online } from '~/composables/useOfflineQueue'
import { useDeductionItems } from '~/composables/useDeductionItems'

interface Props {
  open: boolean
  visit: VisitRow | null
  /** المشرف الميداني صاحب الزيارة — يحفظ ما دامت غيرَ مقفلة؛ غيره يطّلع. */
  canEdit: boolean
}
const props = defineProps<Props>()
const emit = defineEmits<{ 'update:open': [boolean], 'saved': [] }>()

const supabase = useSupabaseClient<Database>()
const { handle } = useErrorHandler()
const toast = useToast()
const { isAdmin, isTechnical, isTeacher } = usePermissions()

const { pendingFor, shouldQueue, saveOnDevice } = useVisitOffline()
// البنودُ ثابتة: تُجلب مرّةً للجلسة، ولها نسخةٌ على جهاز المشرف
const { criteria } = useDeductionItems()

const executedDay = ref('')
const counts = ref<DeductionCounts>({})
const notes = ref('')
const saving = ref(false)
const busy = ref(false)
const today = ref(gazaToday())

watch(() => [props.open, props.visit?.id, props.visit?.locked_at] as const, ([open]) => {
  const v = props.visit
  if (!open || !v) return
  today.value = gazaToday()
  executedDay.value = v.executed_at ? gazaDayOf(v.executed_at) : props.canEdit ? today.value : ''
  counts.value = parseCounts(v.deductions)
  notes.value = v.notes ?? ''
}, { immediate: true })

/** سطرُ هذه الزيارة على الجهاز (لم يُرفع بعد) — تُعرض للقراءة بشارته. */
const onDevice = computed(() => (props.visit ? pendingFor(props.visit.id) : null))
const locked = computed(() => !!props.visit?.locked_at)
/** يكتب: صاحبُها وهي غيرُ مقفلة. */
const editable = computed(() => props.canEdit && !locked.value)
/** زيارةٌ نُفّذت قبل النموذج (بحقولها القديمة) ولا يكتبها أحدٌ الآن. */
const legacy = computed(() => !!props.visit?.executed_at && props.visit.deductions == null && !editable.value)
const hasResult = computed(() => editable.value || !!props.visit?.executed_at)
const canUnlock = computed(() => locked.value && (isAdmin.value || isTechnical.value))
const canAck = computed(() => locked.value && isTeacher.value && !props.visit?.teacher_ack_at)

async function save() {
  const v = props.visit
  if (!v) return
  if (!executedDay.value || executedDay.value > today.value) {
    toast.add({ title: 'اختر يوم التنفيذ (لا يتجاوز اليوم).', color: 'warning', icon: 'i-lucide-info' })
    return
  }
  saving.value = true
  try {
    if (shouldQueue(v.id)) {
      await saveOnDevice(v.id, { executedAt: executedAtFromDay(executedDay.value), deductions: cleanCounts(counts.value), notes: notes.value.trim() || null })
      toast.add({ title: VISIT_SAVED_ON_DEVICE, color: 'success', icon: 'i-lucide-cloud-upload' })
      emit('update:open', false)
      emit('saved')
      return
    }
    const { data, error } = await supabase.from('supervision_visits').update({
      executed_at: executedAtFromDay(executedDay.value),
      deductions: cleanCounts(counts.value),
      notes: notes.value.trim() || null
    }).eq('id', v.id).select('id')
    if (error) throw error
    if (!data?.length) throw new Error('لم يُحفظ التغيير — هذه الزيارة ليست ضمن صلاحيتك.')
    toast.add({ title: 'حُفظت نتيجة الزيارة وأُقفلت.', description: 'وصل المعلمَ إشعارٌ بها.', color: 'success', icon: 'i-lucide-lock' })
    emit('update:open', false)
    emit('saved')
  } catch (err) {
    handle(err)
  } finally {
    saving.value = false
  }
}

const { queueIfOffline } = useOfflineAck()

async function runRpc(fn: 'unlock_visit_result' | 'acknowledge_visit', done: string) {
  const v = props.visit
  if (!v) return
  busy.value = true
  try {
    // المعلّمُ بلا اتصال: يُحفظ إقرارُه على جهازه ويُرفع لاحقاً (البند 14، 2026-10-27)
    if (fn === 'acknowledge_visit' && await queueIfOffline('visit', v.id)) {
      toast.add({ title: ACK_SAVED_MESSAGE, color: 'success', icon: 'i-lucide-cloud-upload' })
      emit('update:open', false)
      emit('saved')
      return
    }
    const { error } = await supabase.rpc(fn, { p_visit: v.id })
    if (error) throw error
    toast.add({ title: done, color: 'success', icon: 'i-lucide-circle-check' })
    emit('update:open', false)
    emit('saved')
  } catch (err) {
    handle(err)
  } finally {
    busy.value = false
  }
}
</script>

<template>
  <UModal
    :open="open"
    :title="`نتيجة زيارة ${visit?.halaqa?.name || ''}`"
    :ui="{ content: 'max-w-3xl' }"
    @update:open="(v: boolean) => emit('update:open', v)"
  >
    <template #body>
      <div class="form">
        <div
          v-if="visit"
          class="when"
        >
          <span>الموعد المجدول <b dir="ltr">{{ formatVisitMoment(visit.scheduled_at) }}</b></span>
          <span v-if="visit.halaqa?.teacher">المعلّم <b>{{ visit.halaqa.teacher.full_name }}</b></span>
          <span v-if="visit.supervisor">الزائر <b>{{ visit.supervisor.full_name }}</b></span>
        </div>

        <div
          v-if="locked"
          class="lockbar"
          role="status"
        >
          <UIcon
            name="i-lucide-lock"
            class="size-[18px] shrink-0"
          />
          <span v-if="onDevice">{{ PENDING_UPLOAD_BADGE }}</span>
          <span v-else-if="canEdit">حُفظت النتيجة وأُقفلت — يفتحها المدير الإداري أو الفنيّ إن احتجت تصحيحاً.</span>
          <span v-else>النتيجة محفوظة ومقفلة.</span>
          <span
            v-if="!onDevice"
            class="ack"
            :class="{ yes: !!visit?.teacher_ack_at }"
          >{{ visit?.teacher_ack_at ? `اطّلع المعلم ${gazaDayOf(visit.teacher_ack_at).split('-').reverse().join('-')}` : 'لم يطّلع المعلم بعد' }}</span>
        </div>

        <p
          v-if="!hasResult"
          class="pending"
        >
          لم تُرفع نتيجة هذه الزيارة بعد.
        </p>

        <!-- زيارةٌ قبل النموذج: حقولُها القديمة للقراءة -->
        <dl
          v-else-if="legacy"
          class="legacy"
        >
          <div v-if="visit?.flow_rating">
            <dt>تقييم سير الحلقة</dt><dd>{{ visit.flow_rating }}</dd>
          </div>
          <div
            v-for="f in ([['strengths', 'نقاط القوة'], ['improvements', 'جوانب التحسين'], ['recommendations', 'التوصيات'], ['notes', 'ملاحظات']] as const)"
            v-show="visit?.[f[0]]"
            :key="f[0]"
          >
            <dt>{{ f[1] }}</dt><dd>{{ visit?.[f[0]] }}</dd>
          </div>
        </dl>

        <template v-else>
          <UFormField
            label="يوم التنفيذ الفعلي"
            :help="editable ? 'متى رُفعت النتيجة صارت الزيارة «تمّت»، ولو بعد موعدها.' : undefined"
          >
            <input
              v-model="executedDay"
              type="date"
              :min="PROJECT_START_DATE"
              :max="today"
              :disabled="!editable"
              class="date-input"
              dir="ltr"
            >
          </UFormField>

          <VisitsEvaluationForm
            v-model:counts="counts"
            :criteria="criteria"
            :read-only="!editable"
          />

          <UFormField label="ملاحظات المشرف وتوجيهاته">
            <UTextarea
              v-model="notes"
              autoresize
              :rows="3"
              :maxrows="10"
              :disabled="!editable"
              size="lg"
              class="w-full"
              :ui="{ base: 'rounded-[13px] leading-[1.9]' }"
            />
          </UFormField>
        </template>

        <VisitsRescheduleLog
          :open="open"
          :visit-id="visit?.id ?? null"
        />

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
            v-if="canUnlock"
            label="فتح التعديل للمشرف"
            color="neutral"
            variant="outline"
            size="lg"
            icon="i-lucide-lock-open"
            :loading="busy"
            :disabled="!online"
            :title="online ? undefined : 'يحتاج اتصالاً'"
            :ui="{ base: 'rounded-[13px]' }"
            @click="runRpc('unlock_visit_result', 'فُتحت الزيارة للتعديل — وصل المشرفَ إشعار.')"
          />
          <UButton
            v-if="canAck"
            label="اطّلعت على النتيجة"
            color="primary"
            size="lg"
            icon="i-lucide-check-check"
            :loading="busy"
            :ui="{ base: 'rounded-[13px] font-semibold' }"
            @click="runRpc('acknowledge_visit', 'سُجّل اطّلاعك على نتيجة الزيارة.')"
          />
          <UButton
            v-if="editable"
            label="حفظ وإقفال"
            color="primary"
            size="lg"
            icon="i-lucide-lock"
            :loading="saving"
            :disabled="!criteria.length"
            :ui="{ base: 'rounded-[13px] font-semibold' }"
            @click="save"
          />
        </div>
        <p
          v-if="editable"
          class="save-hint"
        >
          بعد الحفظ تُقفل النتيجة ولا تُعدَّل إلا إن فتحها المدير الإداري أو الفنيّ.
        </p>
      </div>
    </template>
  </UModal>
</template>

<style scoped>
.form { display: flex; flex-direction: column; gap: 14px; }
.form-actions { display: flex; justify-content: flex-end; flex-wrap: wrap; gap: 10px; margin-top: 6px; }
.save-hint { margin: -4px 0 0; text-align: end; font-size: 12.5px; color: var(--ink-3); }
.when { display: flex; flex-wrap: wrap; gap: 6px 18px; padding: 12px 14px; border-radius: 13px; background: var(--surface-2); color: var(--ink-3); font-size: 13.5px; }
.when b { color: var(--ink); font-weight: 600; margin-inline-start: 4px; }
.lockbar { display: flex; align-items: center; flex-wrap: wrap; gap: 6px 10px; padding: 10px 14px; border-radius: 13px; background: var(--blue-soft); color: var(--blue-ink); font-size: 13.5px; font-weight: 600; }
.lockbar .ack { margin-inline-start: auto; padding: 2px 10px; border-radius: 999px; background: var(--surface); color: var(--ink-2); font-weight: 600; }
.lockbar .ack.yes { color: var(--green-ink); }
.date-input { height: 44px; padding: 0 12px; border-radius: 13px; border: 1px solid var(--line-2); background: var(--surface-2); color: var(--ink); font-size: 15px; outline: none; }
.date-input:focus { border-color: var(--blue); box-shadow: 0 0 0 3px var(--ring); }
.date-input:disabled { opacity: .7; }
.pending { margin: 0; padding: 14px; border-radius: 13px; background: var(--surface-2); color: var(--ink-2); font-size: 14px; text-align: center; }
.legacy { display: flex; flex-direction: column; gap: 10px; margin: 0; }
.legacy dt { font-size: 12.5px; font-weight: 700; color: var(--ink-3); }
.legacy dd { margin: 3px 0 0; font-size: 14.5px; color: var(--ink); line-height: 1.8; white-space: pre-wrap; }
</style>
