<script setup lang="ts">
/**
 * بطاقات بيانات الطالب (للقراءة فقط) — مشتركة بين ملف الطالب الداخلي وصفحة «صفحتي».
 * الأقسام تُبنى في `buildStudentSections` (utils/studentSections.ts).
 */
import type { StudentSection } from '~/utils/studentSections'

interface Props {
  sections: StudentSection[]
}

defineProps<Props>()
</script>

<template>
  <div class="grid">
    <section
      v-for="sec in sections"
      :key="sec.title"
      class="card"
    >
      <h3>
        <span
          class="ico"
          :class="`ico-${sec.tone}`"
        ><UIcon
          :name="sec.icon"
          class="size-5"
        /></span>
        {{ sec.title }}
      </h3>
      <div class="fields">
        <div
          v-for="f in sec.fields"
          :key="f.label"
          class="field"
          :class="{ wide: f.wide }"
        >
          <div class="f-label">
            {{ f.label }}
          </div>
          <div
            class="f-value"
            :dir="f.ltr ? 'ltr' : undefined"
          >
            {{ f.value }}
          </div>
        </div>
      </div>
    </section>
  </div>
</template>

<style scoped>
.grid { columns: 2; column-gap: 22px; margin-bottom: -22px; }
.card { break-inside: avoid; margin-bottom: 22px; background: var(--surface); border: 1px solid var(--line); border-radius: 20px; padding: 24px; box-shadow: var(--shadow); }
.card h3 { margin: 0 0 18px; font-size: 17px; font-weight: 700; color: var(--ink); display: flex; align-items: center; gap: 10px; }
.ico { width: 36px; height: 36px; border-radius: 11px; display: inline-flex; align-items: center; justify-content: center; flex: none; }
.ico-blue { background: var(--blue-soft); color: var(--blue-ink); }
.ico-green { background: var(--green-soft); color: var(--green-ink); }
.ico-neutral { background: var(--surface-3); color: var(--ink); }
.fields { display: grid; grid-template-columns: repeat(auto-fit, minmax(150px, 1fr)); gap: 12px; }
.field { background: var(--surface-2); border: 1px solid var(--line); border-radius: 14px; padding: 13px 15px; }
.field.wide { grid-column: 1 / -1; }
.f-label { font-size: 12px; color: var(--ink-3); margin-bottom: 7px; font-weight: 500; }
.f-value { font-size: 15.5px; font-weight: 700; color: var(--ink); }

@media (max-width: 768px) { .grid { columns: 1; } }
</style>
