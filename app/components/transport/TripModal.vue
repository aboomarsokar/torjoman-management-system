<script setup lang="ts">
/**
 * نافذةُ رحلة المواصلات: إضافةٌ (بلا `trip`) أو تعديلُ رحلةٍ غير مسدَّدة (بـ`trip`).
 * التسمياتُ فوق الحقول وكلُّها بعرضٍ كامل على الجوال؛ والمبلغُ حقلُ رقمٍ (طلب المستخدم 2026-10-22) ويبقى نصّاً في النموذج لـ`normalizeAmount`.
 * التاريخُ الافتراضيّ للجديدة: اليوم إن كان في الشهر المعروض، وإلا آخرُ يومٍ منه. يُصدر `saved` بعد الحفظ.
 */
import { TRANSPORT_AMOUNT_MAX, TRANSPORT_DESCRIPTION_MAX, TRANSPORT_NOTES_MAX } from '~/constants/transport'
import { gazaToday } from '~/utils/reportWindow'
import { monthBounds, normalizeAmount, validateTrip, type Trip } from '~/utils/transport'

const props = defineProps<{ trip?: Trip | null, year: number, month: number }>()
const emit = defineEmits<{ saved: [] }>()
const open = defineModel<boolean>('open', { default: false })

const { saveTrip } = useTransport()
const { handle } = useErrorHandler()
const toast = useToast()

const saving = ref(false)
const today = computed(() => gazaToday())
const isEdit = computed(() => !!props.trip)
const form = reactive({ trip_date: '', description: '', amount: '', notes: '' })

/** اليومُ إن وقع في الشهر المعروض، وإلا آخرُ يومٍ منه (الشهرُ المعروض لا يتجاوز شهر اليوم). */
function defaultDate(): string {
  const { from, to } = monthBounds(props.year, props.month)
  const t = today.value
  if (t >= from && t < to) return t
  const last = new Date(Date.UTC(props.year, props.month, 0)).getUTCDate()
  return `${from.slice(0, 8)}${String(last).padStart(2, '0')}`
}

// تُملأ عند الفتح، وتُعاد إن تبدّلت الرحلةُ والنافذةُ مفتوحة
watch([open, () => props.trip], ([v]) => {
  if (!v) return
  const t = props.trip
  form.trip_date = t ? t.trip_date : defaultDate()
  form.description = t?.description ?? ''
  form.amount = t ? String(t.amount) : ''
  form.notes = t?.notes ?? ''
})

const validate = (s: typeof form) => validateTrip(s, today.value)

async function save() {
  saving.value = true
  try {
    await saveTrip({
      id: props.trip?.id,
      trip_date: form.trip_date,
      description: form.description.trim(),
      amount: Number(normalizeAmount(form.amount)),
      notes: form.notes.trim() || null
    })
    toast.add({ title: 'حُفظت الرحلة.', color: 'success', icon: 'i-lucide-circle-check' })
    open.value = false
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
    v-model:open="open"
    :title="isEdit ? 'تعديل رحلة' : 'إضافة رحلة'"
  >
    <template #body>
      <UForm
        :state="form"
        :validate="validate"
        class="form"
        @submit="save"
      >
        <div class="pair">
          <UFormField
            label="التاريخ"
            name="trip_date"
            required
          >
            <UInput
              v-model="form.trip_date"
              type="date"
              :max="today"
              size="lg"
              class="w-full"
              :ui="{ base: 'rounded-[13px] min-h-11' }"
            />
          </UFormField>
          <UFormField
            label="المبلغ"
            name="amount"
            required
          >
            <UInput
              :model-value="form.amount"
              type="number"
              inputmode="decimal"
              min="0"
              :max="TRANSPORT_AMOUNT_MAX"
              step="any"
              :placeholder="`حتى ${TRANSPORT_AMOUNT_MAX}`"
              size="lg"
              class="w-full"
              :ui="{ base: 'rounded-[13px] min-h-11' }"
              @update:model-value="v => form.amount = v == null ? '' : String(v)"
            >
              <template #trailing>
                <span class="unit">₪</span>
              </template>
            </UInput>
          </UFormField>
        </div>
        <UFormField
          label="البيان"
          name="description"
          required
          :hint="`${form.description.trim().length}/${TRANSPORT_DESCRIPTION_MAX}`"
        >
          <UInput
            v-model="form.description"
            placeholder="مثال: زيارة حلقة"
            size="lg"
            class="w-full"
            :ui="{ base: 'rounded-[13px] min-h-11' }"
          />
        </UFormField>
        <UFormField
          label="ملاحظات (اختياري)"
          name="notes"
          :hint="`${form.notes.length}/${TRANSPORT_NOTES_MAX}`"
        >
          <UTextarea
            v-model="form.notes"
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
            :ui="{ base: 'rounded-[13px] min-h-11' }"
            @click="open = false"
          />
          <UButton
            type="submit"
            label="حفظ الرحلة"
            color="primary"
            size="lg"
            icon="i-lucide-check"
            :loading="saving"
            :ui="{ base: 'rounded-[13px] min-h-11 font-semibold' }"
          />
        </div>
      </UForm>
    </template>
  </UModal>
</template>

<style scoped>
.form { display: flex; flex-direction: column; gap: 16px; }
.pair { display: grid; grid-template-columns: 1fr 1fr; gap: 16px; }
.pair > * { min-width: 0; }
.unit { color: var(--ink-3); font-weight: 600; }
.form-actions { display: flex; justify-content: flex-end; gap: 10px; margin-top: 4px; }
@media (max-width: 560px) {
  .pair { grid-template-columns: 1fr; }
}
</style>
