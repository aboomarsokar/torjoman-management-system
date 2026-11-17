<script setup lang="ts">
/**
 * حسمُ طلب مسار: ملاحظةٌ (إلزاميةٌ للرفض، اختياريةٌ للاعتماد) ثم «اعتماد» أو «رفض». يسري المعتمَدُ من أوّل الفصل
 * التالي، واستثناءً من الشهر التالي لمن طلب الثاني ونقص عن نصابه في الشهر السابق — تحسبه القاعدة.
 */
import { TRACKS, type TrackNo } from '~/constants/tracks'

interface Props {
  halaqa: string
  track: TrackNo
  requestNote: string | null
  busy: boolean
}
const props = defineProps<Props>()
const emit = defineEmits<{ decide: [approve: boolean, note: string] }>()
const open = defineModel<boolean>('open', { required: true })

const note = ref('')
watch(open, (v) => {
  if (v) note.value = ''
})
const canReject = computed(() => note.value.trim().length > 0)
const title = computed(() => `${props.halaqa} — ${TRACKS[props.track].label}`)
</script>

<template>
  <UModal
    v-model:open="open"
    :title="title"
    description="يسري المعتمَدُ من أوّل الفصل التالي، أو من الشهر التالي لمن طلب الثاني ونقص عن نصابه في الشهر السابق."
  >
    <template #body>
      <div class="dm">
        <p
          v-if="requestNote"
          class="dm-req"
        >
          ملاحظةُ الطلب: {{ requestNote }}
        </p>
        <UFormField
          label="ملاحظتك"
          hint="إلزاميةٌ للرفض"
        >
          <UTextarea
            v-model="note"
            :maxlength="300"
            :rows="3"
            class="w-full"
          />
        </UFormField>
      </div>
    </template>
    <template #footer>
      <div class="dm-actions">
        <UButton
          label="اعتماد"
          color="primary"
          size="lg"
          :loading="busy"
          :ui="{ base: 'min-h-11 rounded-[13px]' }"
          @click="emit('decide', true, note)"
        />
        <UButton
          label="رفض"
          color="error"
          variant="outline"
          size="lg"
          :disabled="!canReject || busy"
          :ui="{ base: 'min-h-11 rounded-[13px]' }"
          @click="emit('decide', false, note)"
        />
      </div>
    </template>
  </UModal>
</template>

<style scoped>
.dm { display: flex; flex-direction: column; gap: 14px; }
.dm-req { margin: 0; padding: 10px 12px; border-radius: 12px; background: var(--blue-soft); color: var(--blue-ink); font-size: 14.5px; line-height: 1.7; }
.dm-actions { display: flex; gap: 10px; flex-wrap: wrap; }
</style>
