<script setup lang="ts">
/**
 * حلقةٌ في طابور الرصد (طلب المستخدم 2026-11-10): رأسٌ باسمها ومعلّمها ومختبِرها، والدورةُ مرّةً واحدة متى توحّدت،
 * وعددُ المنتظرين وأطولُ انتظار؛ وتحته طلابُها سطراً سطراً بانتظار كلٍّ وزرِّ الرصد (وسحبِ الترشيح للمديرَين).
 * الانتظارُ هادئٌ حتى أسبوع، ثم برتقاليّ، ثم أحمر بعد أسبوعين (`waitTone`).
 */
import { waitLabel, waitTone, type QueueGroup, type QueueItem } from '~/utils/exams/queueGroups'

interface Props {
  group: QueueGroup
  /** سحبُ الترشيح المعلّق — للمديرَين. */
  canWithdraw: boolean
  online: boolean
}
const props = defineProps<Props>()
defineEmits<{ grade: [QueueItem], withdraw: [QueueItem] }>()

const female = computed(() => props.group.items[0]?.gender === 'female')
/** «طالبةٌ واحدة» · «طالبتان» · «5 طالبات» · «13 طالبة». */
const countText = computed(() => {
  const n = props.group.items.length
  if (female.value) return n === 1 ? 'طالبةٌ واحدة' : n === 2 ? 'طالبتان' : n <= 10 ? `${n} طالبات` : `${n} طالبة`
  return n === 1 ? 'طالبٌ واحد' : n === 2 ? 'طالبان' : n <= 10 ? `${n} طلاب` : `${n} طالباً`
})
const headId = computed(() => `qg-${props.group.halaqaId}`)
</script>

<template>
  <section
    class="qg"
    :aria-labelledby="headId"
  >
    <header class="qg-head">
      <div class="qg-id">
        <h4 :id="headId">
          {{ group.halaqa }}
        </h4>
        <p class="qg-meta">
          <span>{{ female ? 'المعلّمة' : 'المعلّم' }}: {{ group.teacher }}</span>
          <span v-if="group.examiner">{{ female ? 'المختبِرة' : 'المختبِر' }}: {{ group.examiner }}</span>
        </p>
        <p
          v-if="group.cycle"
          class="qg-cycle"
        >
          <UIcon
            name="i-lucide-book-open"
            class="size-4 shrink-0"
          />
          <span><b>{{ group.cycle.title }}</b><template v-if="group.cycle.span"> — {{ group.cycle.span }}</template></span>
        </p>
      </div>
      <div class="qg-tags">
        <span class="qg-n">{{ countText }}</span>
        <span
          v-if="group.oldest !== null"
          class="wait"
          :class="`w-${waitTone(group.oldest)}`"
        >
          <UIcon
            name="i-lucide-hourglass"
            class="size-3.5"
          />
          {{ group.items.length > 1 ? 'أقدمُهم' : 'ينتظر' }} {{ waitLabel(group.oldest) }}
        </span>
      </div>
    </header>

    <ol class="qg-list">
      <li
        v-for="(it, i) in group.items"
        :key="it.id"
        class="qg-row"
      >
        <span class="qg-seq">{{ i + 1 }}</span>
        <span class="qg-who">
          <b>{{ it.name }}</b>
          <small v-if="!group.cycle">{{ it.title }}<template v-if="it.span"> — {{ it.span }}</template></small>
        </span>
        <span
          v-if="it.waitDays !== null"
          class="qg-wait"
          :class="`w-${waitTone(it.waitDays)}`"
        >{{ waitLabel(it.waitDays) }}</span>
        <span class="qg-acts">
          <UButton
            label="رصد النتيجة"
            color="primary"
            icon="i-lucide-clipboard-pen"
            class="qg-btn"
            :ui="{ base: 'rounded-[10px]' }"
            @click="$emit('grade', it)"
          />
          <UButton
            v-if="canWithdraw"
            color="neutral"
            variant="outline"
            icon="i-lucide-undo-2"
            class="qg-btn qg-btn-icon"
            :aria-label="`سحب ترشيح ${it.name}`"
            :disabled="!online"
            :title="online ? 'سحب الترشيح' : 'يحتاج اتصالاً'"
            :ui="{ base: 'rounded-[10px] justify-center' }"
            @click="$emit('withdraw', it)"
          />
        </span>
      </li>
    </ol>
  </section>
</template>

<style scoped>
.qg { background: var(--surface); border: 1px solid var(--line); border-radius: var(--r-card); overflow: hidden; }
.qg-head { display: flex; align-items: flex-start; justify-content: space-between; gap: 10px 16px; flex-wrap: wrap; padding: 16px 18px 14px; background: var(--surface-2); border-bottom: 1px solid var(--line); }
.qg-id { min-width: 0; flex: 1 1 280px; display: flex; flex-direction: column; gap: 4px; }
.qg-id h4 { margin: 0; font-size: 16.5px; font-weight: 600; color: var(--ink); line-height: 1.4; }
.qg-meta { margin: 0; display: flex; flex-wrap: wrap; gap: 2px 14px; font-size: 13px; color: var(--ink-2); }
.qg-cycle { margin: 2px 0 0; display: flex; align-items: flex-start; gap: 6px; font-size: 13px; color: var(--blue-ink); line-height: 1.6; }
.qg-cycle b { font-weight: 600; }
.qg-tags { display: flex; align-items: center; gap: 8px; flex-wrap: wrap; }
.qg-n { display: inline-flex; align-items: center; height: 28px; padding: 0 12px; border-radius: 999px; background: var(--blue-soft); color: var(--blue-ink); font-size: 13px; font-weight: 600; font-variant-numeric: tabular-nums; }
.wait { display: inline-flex; align-items: center; gap: 5px; height: 28px; padding: 0 11px; border-radius: 999px; font-size: 13px; font-weight: 600; font-variant-numeric: tabular-nums; white-space: nowrap; }
.wait.w-calm { background: var(--chip-muted-bg); color: var(--chip-muted-ink); }
.wait.w-warn { background: var(--chip-warn-bg); color: var(--chip-warn-ink); }
.wait.w-late { background: var(--err-soft); color: var(--err); }

.qg-list { list-style: none; margin: 0; padding: 0; }
.qg-row { display: flex; align-items: center; gap: 12px; padding: 10px 18px; min-height: 60px; }
.qg-row + .qg-row { border-top: 1px solid var(--line); }
.qg-seq { flex: none; width: 24px; text-align: center; font-size: 13px; color: var(--ink-3); font-variant-numeric: tabular-nums; }
.qg-who { flex: 1; min-width: 0; display: flex; flex-direction: column; gap: 1px; }
.qg-who b { font-size: 15px; font-weight: 600; color: var(--ink); }
.qg-who small { font-size: 12.5px; color: var(--ink-2); }
.qg-wait { flex: none; font-size: 12.5px; color: var(--ink-3); font-variant-numeric: tabular-nums; white-space: nowrap; }
.qg-wait.w-warn { color: var(--chip-warn-ink); font-weight: 600; }
.qg-wait.w-late { color: var(--err); font-weight: 600; }
.qg-acts { flex: none; display: flex; gap: 8px; }
.qg-btn { min-height: 40px; }
.qg-btn-icon { min-width: 40px; }

@media (max-width: 600px) {
  .qg-head { padding: 14px; }
  .qg-row { flex-wrap: wrap; padding: 12px 14px; row-gap: 8px; }
  .qg-who { flex-basis: calc(100% - 120px); }
  .qg-acts { flex-basis: 100%; }
  .qg-acts .qg-btn:first-child { flex: 1; }
  .qg-btn { min-height: 44px; }
  .qg-btn-icon { min-width: 44px; }
}
</style>
