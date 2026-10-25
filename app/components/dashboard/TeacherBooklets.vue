<script setup lang="ts">
/**
 * «الملازم المستلَمة» في لوحة المعلّم (طلب المستخدم 2026-10-25): ما استلمته حلقتُه من ملازم المشروع بنُسخها
 * وآخرِ تسليم. القراءةُ بسياسة `booklet_deliveries_select` (المعلّمُ لحلقته وحدَها).
 */
import { deliveryDate, halaqaBooklets, type DeliveryRow } from '~/utils/booklets'

const props = defineProps<{ halaqaId: string, halaqaName: string }>()

const supabase = useSupabaseClient()
const { data: rows, pending } = useLazyAsyncData<DeliveryRow[]>(`teacher-booklets-${props.halaqaId}`, async () => {
  const { data, error } = await supabase.from('booklet_deliveries').select('*').eq('halaqa_id', props.halaqaId)
    .returns<DeliveryRow[]>()
  if (error) {
    console.error('[teacher-booklets] فشل الجلب:', error.message)
    return []
  }
  return data ?? []
}, { server: false, default: () => [] })

const mine = computed(() => halaqaBooklets(rows.value ?? [], [{ id: props.halaqaId, name: props.halaqaName, status: 'active' }])[0]!)
</script>

<template>
  <section
    class="tb card"
    aria-labelledby="tb-title"
  >
    <div class="tb-head">
      <span class="tb-ico"><UIcon
        name="i-lucide-book-copy"
        class="size-5"
      /></span>
      <h3 id="tb-title">
        الملازم المستلَمة
      </h3>
      <span
        v-if="mine.total"
        class="tb-total"
      ><b>{{ mine.total }}</b> نسخة</span>
    </div>
    <p
      v-if="pending && !rows?.length"
      class="tb-muted"
    >
      …
    </p>
    <p
      v-else-if="!mine.total"
      class="tb-muted"
    >
      لم تستلم حلقتُك ملازمَ بعد.
    </p>
    <template v-else>
      <div class="tb-chips">
        <span
          v-for="b in mine.booklets"
          :key="b.no"
          class="tb-chip"
        >{{ b.label }} <b>× {{ b.copies }}</b></span>
      </div>
      <p
        v-if="mine.lastOn"
        class="tb-muted"
      >
        آخر تسليم <bdi dir="ltr">{{ deliveryDate(mine.lastOn) }}</bdi>
      </p>
    </template>
  </section>
</template>

<style scoped>
.card { background: var(--surface); border: 1px solid var(--line); border-radius: 20px; box-shadow: var(--shadow); padding: 18px 22px; }
.tb { display: flex; flex-direction: column; gap: 12px; }
.tb-head { display: flex; align-items: center; gap: 10px; }
.tb-ico { width: 36px; height: 36px; border-radius: 11px; display: inline-flex; align-items: center; justify-content: center; flex: none; background: var(--blue-soft); color: var(--blue-ink); }
.tb-head h3 { margin: 0; flex: 1; font-size: 15px; font-weight: 700; color: var(--ink); }
.tb-total { font-size: 13.5px; color: var(--ink-2); }
.tb-total b { font-size: 18px; color: var(--ink); font-variant-numeric: tabular-nums; }
.tb-chips { display: flex; flex-wrap: wrap; gap: 6px; }
.tb-chip { padding: 4px 11px; border-radius: 999px; background: var(--surface-2); color: var(--ink-2); font-size: 13.5px; white-space: nowrap; }
.tb-chip b { color: var(--blue-ink); font-variant-numeric: tabular-nums; }
.tb-muted { margin: 0; font-size: 13.5px; color: var(--ink-3); }
.tb-muted bdi { font-variant-numeric: tabular-nums; }
@media (max-width: 560px) { .card { padding: 16px; } }
</style>
