<script setup lang="ts">
/**
 * «المطلوب منك الآن» في لوحة المعلم — بنودٌ مرتّبة بالأولوية (أُعيد إليك ← ينتظرك ← أُنجز)، والبطاقةُ كلُّها
 * رابطٌ إلى شاشتها (بزرٍّ ظاهرٍ للمعلّق، وسهمٍ للمُنجَز). تُبنى خارجه بـ`teacherActions` (utils/teacherDashboard.ts، مختبَرة).
 */
import { NuxtLink } from '#components'
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
      >
        <!-- البطاقةُ كلُّها رابطٌ واحد (طلب المستخدم 2026-10-21: الضغطُ في أيّ مكانٍ منها لا على السهم وحده)،
             و«الزرّ» داخلها شكلٌ لا عنصرٌ تفاعليّ ثانٍ -->
        <component
          :is="a.to ? NuxtLink : 'div'"
          :to="a.to"
          class="act"
          :class="[a.tone, { linked: !!a.to }]"
        >
          <span class="a-ico"><UIcon
            :name="a.icon"
            class="size-5"
          /></span>
          <span class="a-body">
            <span class="a-title">{{ a.title }}</span>
            <span
              v-if="a.detail"
              class="a-detail"
            >{{ a.detail }}</span>
          </span>
          <span
            v-if="a.cta && a.to"
            class="a-cta"
          >{{ a.cta }}</span>
          <UIcon
            v-else-if="a.to"
            name="i-lucide-chevron-left"
            class="a-chev size-5"
          />
        </component>
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
.act { display: flex; align-items: center; gap: 14px; padding: 14px 16px; border-radius: 16px; border: 1px solid var(--line); background: var(--surface-2); color: inherit; text-decoration: none; }
.act.urgent { background: var(--err-soft); border-color: color-mix(in oklab, var(--err) 30%, transparent); }
.act.done { background: transparent; }
.act.linked { cursor: pointer; transition: border-color .15s, background-color .15s; }
.act.linked:hover { border-color: var(--blue); }
.act.done.linked:hover { background: var(--surface-2); }
.act.linked:focus-visible { outline: none; box-shadow: 0 0 0 3px var(--ring); }
.a-ico { width: 38px; height: 38px; border-radius: 11px; display: inline-flex; align-items: center; justify-content: center; flex: none; background: var(--blue-soft); color: var(--blue-ink); }
.urgent .a-ico { background: var(--surface); color: var(--err); }
.done .a-ico { background: var(--green-soft); color: var(--green-ink); }
.a-body { flex: 1; min-width: 0; display: flex; flex-direction: column; }
.a-title { font-size: 15px; font-weight: 700; color: var(--ink); line-height: 1.5; }
.done .a-title { font-weight: 600; color: var(--ink-2); }
.a-detail { margin-top: 3px; font-size: 13.5px; color: var(--ink-2); line-height: 1.7; }
/* شكلُ زرّ الإجراء — البطاقةُ نفسُها هي الرابط */
.a-cta {
  flex: none; display: inline-flex; align-items: center; justify-content: center; min-height: 44px; padding: 0 18px;
  border-radius: 12px; background: var(--primary); color: var(--on-primary); font-size: 14.5px; font-weight: 600; transition: background-color .15s;
}
.act.linked:hover .a-cta { background: var(--primary-hover); }
.urgent .a-cta { background: var(--surface); color: var(--err); }
.act.urgent.linked:hover .a-cta { background: var(--surface); }
.a-chev { flex: none; margin-inline: 10px; color: var(--ink-3); transition: color .15s, transform .15s; }
.act.linked:hover .a-chev { color: var(--ink); transform: translateX(-2px); }

@media (max-width: 560px) {
  .acts { padding: 16px; }
  .act { flex-wrap: wrap; padding: 12px 14px; }
  .a-cta { width: 100%; }
}
</style>
