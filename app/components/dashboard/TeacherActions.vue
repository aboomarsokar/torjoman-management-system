<script setup lang="ts">
/**
 * «المطلوب منك الآن» في لوحة المعلم — بنودٌ مرتّبة بالأولوية (أُعيد إليك ← ينتظرك ← أُنجز)، لكلٍّ زرٌّ
 * يوصل إليه. تُبنى خارجه بـ`teacherActions` (utils/teacherDashboard.ts، مختبَرة).
 */
import type { TeacherAction } from '~/utils/teacherDashboard'

interface Props {
  actions: TeacherAction[]
}

const props = defineProps<Props>()
const pendingCount = computed(() => props.actions.filter(a => a.tone !== 'done').length)
</script>

<template>
  <section
    class="acts"
    aria-labelledby="acts-title"
  >
    <h2 id="acts-title">
      المطلوب منك الآن
      <span
        v-if="pendingCount"
        class="count"
      >{{ pendingCount }}</span>
    </h2>
    <p
      v-if="!pendingCount"
      class="clear"
    >
      <UIcon
        name="i-lucide-circle-check"
        class="size-5"
      />
      لا شيء معلّق — أحسنت.
    </p>
    <ul>
      <li
        v-for="a in actions"
        :key="a.key"
        class="act"
        :class="a.tone"
      >
        <span class="a-ico"><UIcon
          :name="a.icon"
          class="size-5"
        /></span>
        <div class="a-body">
          <div class="a-title">
            {{ a.title }}
          </div>
          <div
            v-if="a.detail"
            class="a-detail"
          >
            {{ a.detail }}
          </div>
        </div>
        <UButton
          v-if="a.cta && a.to"
          :to="a.to"
          :label="a.cta"
          :color="a.tone === 'urgent' ? 'error' : 'primary'"
          :variant="a.tone === 'urgent' ? 'soft' : 'solid'"
          size="md"
          class="a-cta"
          :ui="{ base: 'min-h-11 rounded-xl font-semibold justify-center' }"
        />
        <NuxtLink
          v-else-if="a.to"
          :to="a.to"
          class="a-link"
          :aria-label="`فتح: ${a.title}`"
        ><UIcon
          name="i-lucide-chevron-left"
          class="size-5"
        /></NuxtLink>
      </li>
    </ul>
  </section>
</template>

<style scoped>
.acts { background: var(--surface); border: 1px solid var(--line); border-radius: 20px; box-shadow: var(--shadow); padding: 20px 22px; }
h2 { margin: 0 0 14px; font-size: 17px; font-weight: 700; color: var(--ink); display: flex; align-items: center; gap: 10px; }
.count { min-width: 26px; height: 26px; padding: 0 8px; border-radius: 999px; background: var(--primary); color: var(--on-primary); font-size: 13px; display: inline-flex; align-items: center; justify-content: center; }
.clear { margin: 0 0 12px; display: flex; align-items: center; gap: 8px; font-size: 14.5px; font-weight: 600; color: var(--green-ink); }
ul { list-style: none; margin: 0; padding: 0; display: flex; flex-direction: column; gap: 10px; }
.act { display: flex; align-items: center; gap: 14px; padding: 14px 16px; border-radius: 16px; border: 1px solid var(--line); background: var(--surface-2); }
.act.urgent { background: var(--err-soft); border-color: color-mix(in oklab, var(--err) 30%, transparent); }
.act.done { background: transparent; }
.a-ico { width: 38px; height: 38px; border-radius: 11px; display: inline-flex; align-items: center; justify-content: center; flex: none; background: var(--blue-soft); color: var(--blue-ink); }
.urgent .a-ico { background: var(--surface); color: var(--err); }
.done .a-ico { background: var(--green-soft); color: var(--green-ink); }
.a-body { flex: 1; min-width: 0; }
.a-title { font-size: 15px; font-weight: 700; color: var(--ink); line-height: 1.5; }
.done .a-title { font-weight: 600; color: var(--ink-2); }
.a-detail { margin-top: 3px; font-size: 13.5px; color: var(--ink-2); line-height: 1.7; }
.a-cta { flex: none; }
.a-link { flex: none; width: 44px; height: 44px; border-radius: 12px; display: inline-flex; align-items: center; justify-content: center; color: var(--ink-3); }
.a-link:hover { background: var(--surface-2); color: var(--ink); }

@media (max-width: 560px) {
  .acts { padding: 16px; }
  .act { flex-wrap: wrap; padding: 12px 14px; }
  .a-cta { width: 100%; }
}
</style>
