<script setup lang="ts">
/**
 * طلبُ المعلم تغييرَ مسار حلقته: المسارُ الآخر وملاحظةٌ اختيارية، مع بيان متى يسري (أوّلُ الفصل التالي؛
 * واستثناءً الشهرُ التالي لمن طلب الثاني ونقص عن نصابه في الشهر السابق). يعتمده المدير الإداري.
 */
import { TRACKS, type TrackNo } from '~/constants/tracks'

interface Props {
  /** المسارُ المطلوب (الآخرُ غيرُ مسار الفصل التالي). */
  track: TrackNo
  /** «MM-YYYY» لأوّل الفصل التالي. */
  termLabel: string
  busy: boolean
}
const props = defineProps<Props>()
const emit = defineEmits<{ submit: [note: string] }>()
const open = defineModel<boolean>('open', { required: true })

const note = ref('')
watch(open, (v) => {
  if (v) note.value = ''
})
const spec = computed(() => TRACKS[props.track])
</script>

<template>
  <UModal
    v-model:open="open"
    :title="`طلب ${spec.label}`"
    :description="`نصابه ${spec.quota} طالباً محتسباً وأصلُ مكافأته ${spec.amount} شيكل.`"
  >
    <template #body>
      <div class="trm">
        <p class="trm-when">
          يسري من أوّل الفصل التالي (<bdi dir="ltr">{{ termLabel }}</bdi>) بعد اعتماد المدير الإداري<template v-if="track === 2">
            — أو من الشهر التالي إن نقصت حلقتك عن نصابها في الشهر السابق
          </template>.
        </p>
        <UFormField
          label="ملاحظة (اختيارية)"
          :hint="`${note.length}/300`"
        >
          <UTextarea
            v-model="note"
            :maxlength="300"
            :rows="3"
            class="w-full"
            placeholder="سببُ الطلب إن أردت"
          />
        </UFormField>
      </div>
    </template>
    <template #footer>
      <div class="trm-actions">
        <UButton
          label="إرسال الطلب"
          color="primary"
          size="lg"
          :loading="busy"
          :ui="{ base: 'min-h-11 rounded-[13px]' }"
          @click="emit('submit', note)"
        />
        <UButton
          label="إلغاء"
          color="neutral"
          variant="ghost"
          size="lg"
          :ui="{ base: 'min-h-11 rounded-[13px]' }"
          @click="open = false"
        />
      </div>
    </template>
  </UModal>
</template>

<style scoped>
.trm { display: flex; flex-direction: column; gap: 14px; }
.trm-when { margin: 0; font-size: 14.5px; line-height: 1.8; color: var(--ink-2); }
.trm-actions { display: flex; gap: 10px; flex-wrap: wrap; }
</style>
