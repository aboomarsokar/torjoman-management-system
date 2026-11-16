<script setup lang="ts">
/**
 * تعيينُ مسار حلقةٍ مباشرةً (تصحيحٌ للمدير الإداري): المسار، والشهرُ الذي يسري منه (الحاليُّ فما بعده)، وسببٌ إلزاميّ.
 * ترفض القاعدةُ شهراً مضى أو شهراً بعده سجلُّ تقييمٍ مقفل.
 */
import { TRACKS, type TrackNo } from '~/constants/tracks'

interface Props {
  halaqa: string
  current: TrackNo
  /** أوّلُ شهرٍ يُسمح به. */
  min: { year: number, month: number }
  busy: boolean
}
const props = defineProps<Props>()
const emit = defineEmits<{ assign: [track: TrackNo, year: number, month: number, reason: string] }>()
const open = defineModel<boolean>('open', { required: true })

/** عددُ الأشهر المعروضة للاختيار من الشهر الحاليّ. */
const MONTH_CHOICES = 6

const track = ref<TrackNo>(1)
const from = ref('')
const reason = ref('')
const months = computed(() => Array.from({ length: MONTH_CHOICES }, (_, i) => {
  const idx = props.min.year * 12 + (props.min.month - 1) + i
  const y = Math.floor(idx / 12)
  const m = (idx % 12) + 1
  return { label: `${String(m).padStart(2, '0')}-${y}`, value: `${y}-${m}` }
}))
const trackItems = [1, 2].map(n => ({ label: `${TRACKS[n as TrackNo].label} (${TRACKS[n as TrackNo].quota} · ${TRACKS[n as TrackNo].amount})`, value: n }))
watch(open, (v) => {
  if (!v) return
  track.value = props.current === 1 ? 2 : 1
  from.value = months.value[0]!.value
  reason.value = ''
})
const valid = computed(() => reason.value.trim().length >= 3 && !!from.value)
function submit() {
  const [y, m] = from.value.split('-').map(Number)
  emit('assign', track.value, y!, m!, reason.value.trim())
}
</script>

<template>
  <UModal
    v-model:open="open"
    :title="`تعيين مسار — ${halaqa}`"
    description="تصحيحٌ مباشر يسري من الشهر المختار؛ ولا يُعيَّن لشهرٍ سجلُّه مقفل."
  >
    <template #body>
      <div class="am">
        <UFormField label="المسار">
          <USelect
            v-model="track"
            :items="trackItems"
            class="w-full"
          />
        </UFormField>
        <UFormField label="يسري من">
          <USelect
            v-model="from"
            :items="months"
            class="w-full"
          />
        </UFormField>
        <UFormField
          label="السبب"
          required
        >
          <UTextarea
            v-model="reason"
            :maxlength="300"
            :rows="3"
            class="w-full"
          />
        </UFormField>
      </div>
    </template>
    <template #footer>
      <UButton
        label="تعيين"
        color="primary"
        size="lg"
        :loading="busy"
        :disabled="!valid"
        :ui="{ base: 'min-h-11 rounded-[13px]' }"
        @click="submit"
      />
    </template>
  </UModal>
</template>

<style scoped>
.am { display: flex; flex-direction: column; gap: 14px; }
</style>
