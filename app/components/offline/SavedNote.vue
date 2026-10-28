<script setup lang="ts">
/**
 * سطرُ «معروضٌ من جهازك — آخرُ تحديث …» حين تعرض الشاشةُ نسخةَ الجهاز بلا اتصال (البند 14، 2026-10-27). يقرأ
 * مفاتيحَ الجلب المعروضة من الجهاز (`useOfflineCopy`) فيظهر وحده ويختفي حين يُجلب الجديد، وأقدمُ نسخةٍ هي المذكورة.
 */
import { formatSavedAt } from '~/utils/offlineSnapshot'

/** `keys` مفاتيحُ الجلب، ومفتاحٌ ينتهي بـ`*` بادئةٌ (مفتاحٌ يتبع الحلقةَ أو الشهر المختار). */
const props = defineProps<{ keys: string[] }>()
const saved = useOfflineSavedKeys()
const matches = (k: string) => props.keys.some(p => (p.endsWith('*') ? k.startsWith(p.slice(0, -1)) : k === p))
const oldest = computed(() => Object.entries(saved.value).filter(([k]) => matches(k)).map(([, at]) => at).sort()[0] ?? null)
</script>

<template>
  <p
    v-if="oldest"
    class="sn"
    role="status"
  >
    <UIcon
      name="i-lucide-cloud-off"
      class="size-4 shrink-0"
    />
    <span>معروضٌ من جهازك — آخرُ تحديثٍ <bdi>{{ formatSavedAt(oldest) }}</bdi>، ويُحدَّث حين يعود الاتصال.</span>
  </p>
</template>

<style scoped>
.sn { display: flex; align-items: center; gap: 8px; margin: 0 0 14px; padding: 10px 14px; border-radius: 12px; background: var(--surface-2); border: 1px solid var(--line); font-size: 13.5px; font-weight: 600; color: var(--ink-2); }
.sn bdi { font-variant-numeric: tabular-nums; }
</style>
