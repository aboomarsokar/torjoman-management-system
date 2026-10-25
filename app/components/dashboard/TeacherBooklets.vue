<script setup lang="ts">
/**
 * «الملازم المستلَمة» في لوحة المعلّم (طلب المستخدم 2026-10-25): ما استلمته حلقتُه من ملازم المشروع بنُسخها
 * وآخرِ تسليم. القراءةُ بسياسة `booklet_deliveries_select` (المعلّمُ لحلقته وحدَها).
 */
import { deliveryDate, halaqaBooklets, type DeliveryRow } from '~/utils/booklets'
import { BOOKLETS } from '~/constants/booklets'
import type { RequestDraft } from '~/composables/useBookletRequests'

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

// طلبُ ملازم من المعلّم (2026-10-25) — وطلباتُه الأخيرة بحالتها
const { requests, busy, addRequest } = useBookletRequests(props.halaqaId)
const requestOpen = ref(false)
const recent = computed(() => (requests.value ?? []).slice(0, 4))
const label = (n: number) => BOOKLETS.find(b => b.no === n)?.label ?? `الملزمة ${n}`
async function sendRequest(d: RequestDraft) {
  if (await addRequest(props.halaqaId, d)) requestOpen.value = false
}
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
      <UButton
        label="اطلب ملازم"
        icon="i-lucide-send"
        color="neutral"
        variant="outline"
        size="sm"
        :ui="{ base: 'rounded-[10px] min-h-9' }"
        @click="requestOpen = true"
      />
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

    <ul
      v-if="recent.length"
      class="tb-reqs"
      aria-label="طلباتي"
    >
      <li
        v-for="r in recent"
        :key="r.id"
      >
        <UIcon
          :name="r.status === 'open' ? 'i-lucide-hourglass' : 'i-lucide-circle-check'"
          class="size-4"
          :class="r.status === 'open' ? 'is-open' : 'is-done'"
        />
        <span>طلب {{ label(r.booklet) }} × {{ r.copies }}</span>
        <UBadge
          :label="r.status === 'open' ? 'بانتظار التسليم' : 'تمّ'"
          :color="r.status === 'open' ? 'warning' : 'success'"
          variant="soft"
          size="sm"
        />
      </li>
    </ul>

    <BookletsRequestModal
      v-model:open="requestOpen"
      :busy="busy"
      @save="sendRequest"
    />
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
.tb-reqs { list-style: none; margin: 2px 0 0; padding: 10px 0 0; border-top: 1px dashed var(--line); display: flex; flex-direction: column; gap: 8px; }
.tb-reqs li { display: flex; align-items: center; gap: 8px; font-size: 13.5px; color: var(--ink-2); }
.tb-reqs li span { flex: 1; min-width: 0; }
.is-open { color: var(--ui-warning); }
.is-done { color: var(--green-ink); }
@media (max-width: 560px) { .card { padding: 16px; } }
</style>
