<script setup lang="ts">
/**
 * سجلُّ تغييرات موعد الزيارة وأسبابُها (يظهر للجميع في نافذة النتيجة). يُجلب كلَّما فُتحت النافذة على زيارة —
 * وبلا اتصال لا يُجلب ويُخفى القسمُ (لا نسخةَ له على الجهاز).
 */
import type { Database } from '~/types/database.types'
import { isOnlineNow } from '~/utils/reachability'

const props = defineProps<{ open: boolean, visitId: string | null }>()

const supabase = useSupabaseClient<Database>()
const { handle } = useErrorHandler()
type LogRow = { id: string, old_time: string | null, new_time: string | null, reason: string, changed_at: string }
const log = ref<LogRow[]>([])

watch(() => [props.open, props.visitId] as const, async ([open, visitId]) => {
  log.value = []
  if (!open || !visitId || !isOnlineNow()) return
  const { data, error } = await supabase.from('visit_reschedule_log')
    .select('id, old_time, new_time, reason, changed_at').eq('visit_id', visitId).order('changed_at')
  if (error) handle(error)
  else log.value = data ?? []
}, { immediate: true })
</script>

<template>
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
</template>

<style scoped>
.log h3 { margin: 4px 0 8px; font-size: 14.5px; font-weight: 700; color: var(--ink); }
.log ul { list-style: none; margin: 0; padding: 0; }
.log li { display: flex; flex-direction: column; gap: 3px; padding: 10px 0; }
.log li + li { border-top: 1px solid var(--line); }
.log-times { font-size: 12.5px; color: var(--ink-3); text-align: end; align-self: flex-start; font-variant-numeric: tabular-nums; }
.log-reason { color: var(--ink); font-size: 14px; overflow-wrap: anywhere; }
</style>
