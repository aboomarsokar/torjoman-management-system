<script setup lang="ts">
/**
 * نصُّ تفصيل يومٍ إجازةٍ أو بلاغٍ في «متابعة الرصد» (بلاغ «لم تنعقد» 2026-10-30): السببُ وحكمُ اليوم. يقرأ نفسَه عند
 * ظهوره وكلَّما تغيّر اليوم المفتوح، فلا يثقل الصفحةَ بقراءةٍ لكلّ يوم. المنطقُ في `useRecordingDayReason`.
 */
import type { ReasonState } from '~/utils/recordingStatus'

const props = defineProps<{
  state: ReasonState
  halaqaId: string
  /** اليوم `YYYY-MM-DD`. */
  day: string
  /** الحلقةُ حلقةُ بنات: «المعلّمة». */
  female: boolean
}>()

const { handle } = useErrorHandler()
const { read } = useRecordingDayReason()
const text = ref<string | null>(null)

watch(() => [props.state, props.halaqaId, props.day] as const, async ([state, halaqaId, day]) => {
  text.value = null
  try {
    const next = await read(state, halaqaId, day, props.female)
    // اليومُ المفتوح تغيّر أثناء القراءة: تُهمل نتيجتُها
    if (props.state === state && props.halaqaId === halaqaId && props.day === day) text.value = next
  } catch (err) {
    handle(err)
    text.value = 'تعذّرت قراءة سبب هذا اليوم.'
  }
}, { immediate: true })
</script>

<template>
  <UiSkeletonLines
    v-if="text === null"
    :fields="1"
  />
  <p
    v-else
    class="rdr"
  >
    {{ text }}
  </p>
</template>

<style scoped>
.rdr { margin: 0; font-size: 13.5px; color: var(--ink-2); line-height: 1.8; }
</style>
