<script setup lang="ts">
/**
 * أرشيفُ الملازم حسب الحلقة: لكلّ حلقةٍ مجموعُ ما استلمته وآخرُ تسليم، وشرائحُ الملازم المستلَمة بنُسخها.
 * الحلقاتُ كلُّها تظهر — ومن لم تستلم شيئاً في آخرها بعلامةٍ أخفت لتُلحظ.
 */
import type { HalaqaBooklets } from '~/utils/booklets'
import { deliveryDate } from '~/utils/booklets'

defineProps<{ rows: HalaqaBooklets[] }>()
</script>

<template>
  <ul class="list">
    <li
      v-for="h in rows"
      :key="h.id"
      class="card hrow"
      :class="{ none: !h.total }"
    >
      <div class="head">
        <div class="who">
          <NuxtLink
            :to="`/halqat/${h.id}`"
            class="name"
          >{{ h.name }}</NuxtLink>
          <span
            v-if="h.status !== 'active'"
            class="stopped"
          >متوقفة</span>
        </div>
        <div class="sum">
          <strong class="num">{{ h.total }}</strong>
          <span>نسخة</span>
        </div>
      </div>
      <p
        v-if="!h.total"
        class="empty"
      >
        لم تستلم ملازم بعد.
      </p>
      <template v-else>
        <div class="chips">
          <span
            v-for="b in h.booklets"
            :key="b.no"
            class="chip"
          >{{ b.label }} <b class="num">× {{ b.copies }}</b></span>
        </div>
        <p
          v-if="h.lastOn"
          class="last"
        >
          آخر تسليم <span class="num">{{ deliveryDate(h.lastOn) }}</span>
        </p>
      </template>
    </li>
  </ul>
</template>

<style scoped>
.list { list-style: none; margin: 0; padding: 0; display: flex; flex-direction: column; gap: 12px; }
.card { background: var(--surface); border: 1px solid var(--line); border-radius: 16px; box-shadow: var(--shadow); }
.hrow { padding: 16px 20px; display: flex; flex-direction: column; gap: 10px; }
.hrow.none { box-shadow: none; background: var(--surface-2); }
.head { display: flex; align-items: center; justify-content: space-between; gap: 12px; }
.who { display: flex; align-items: center; gap: 8px; min-width: 0; }
.name { font-weight: 600; font-size: 16px; color: var(--ink); }
.name:hover { color: var(--blue); }
.stopped { font-size: 12px; color: var(--ink-3); border: 1px solid var(--line-2); border-radius: 999px; padding: 1px 8px; }
.sum { display: flex; align-items: baseline; gap: 5px; color: var(--ink-3); font-size: 13px; flex: none; }
.sum strong { font-size: 22px; font-weight: 600; color: var(--navy); }
.none .sum strong { color: var(--ink-3); }
.empty { margin: 0; font-size: 13.5px; color: var(--ink-3); }
.chips { display: flex; flex-wrap: wrap; gap: 8px; }
.chip { display: inline-flex; align-items: center; gap: 6px; padding: 5px 12px; border-radius: 999px; background: color-mix(in oklab, var(--blue) 10%, transparent); color: var(--ink-2); font-size: 13px; }
.chip b { color: var(--navy); font-weight: 600; }
.last { margin: 0; font-size: 12.5px; color: var(--ink-3); }
.num { font-variant-numeric: tabular-nums; }
</style>
