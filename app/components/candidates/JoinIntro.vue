<script setup lang="ts">
/**
 * مقدّمةُ صفحة الالتحاق (طلب المستخدم 2026-10-30): رؤيةُ المشروع، ثم «أهلاً بك» بنقاط المشروع وزرِّ مقرّر المقابلة،
 * ثم شروطُ المعلّم وشروطُ طلابه في بطاقتين قابلتين للطيّ.
 */
import { INTERVIEW_SYLLABUS_URL, JOIN_INTRO, PROJECT_VISION, STUDENT_CONDITIONS, TEACHER_CONDITIONS } from '~/constants/candidates'

const conditions = [
  { key: 'teacher', title: 'شروط المعلّم', icon: 'i-lucide-user-check', items: TEACHER_CONDITIONS, open: true },
  { key: 'students', title: 'شروط طلاب المعلّم', icon: 'i-lucide-users', items: STUDENT_CONDITIONS, open: false }
]
</script>

<template>
  <section
    class="ji"
    aria-label="عن المشروع"
  >
    <figure class="ji-vision">
      <figcaption>رؤية المشروع</figcaption>
      <blockquote>{{ PROJECT_VISION }}</blockquote>
    </figure>

    <div class="ji-welcome">
      <h2>أهلاً بك</h2>
      <p>يسرّنا اهتمامك بالانضمام إلى معلّمي مشروع ترجمان القرآني. قبل التسجيل، اطّلع على ما يلي:</p>
      <dl class="ji-points">
        <div
          v-for="[k, v] in JOIN_INTRO"
          :key="k"
        >
          <dt>{{ k }}</dt><dd>{{ v }}</dd>
        </div>
      </dl>
      <UButton
        :to="INTERVIEW_SYLLABUS_URL"
        target="_blank"
        rel="noopener"
        label="مقرّر المقابلة (ملف PDF)"
        icon="i-lucide-file-down"
        color="primary"
        variant="soft"
        :ui="{ base: 'rounded-[12px] min-h-11 font-semibold self-start' }"
      />
    </div>

    <details
      v-for="c in conditions"
      :key="c.key"
      class="ji-cond"
      :open="c.open"
    >
      <summary>
        <UIcon
          :name="c.icon"
          class="size-5"
        />
        <span>{{ c.title }}</span>
        <UIcon
          name="i-lucide-chevron-down"
          class="ji-chev size-5"
        />
      </summary>
      <ol>
        <li
          v-for="item in c.items"
          :key="item"
        >
          {{ item }}
        </li>
      </ol>
    </details>
  </section>
</template>

<style scoped>
.ji { display: flex; flex-direction: column; gap: 14px; }
.ji-vision { margin: 0; padding: 22px 24px; border-radius: 20px; background: var(--navy); color: var(--on-primary); display: flex; flex-direction: column; gap: 6px; }
.ji-vision figcaption { font-size: 13px; font-weight: 600; opacity: .8; }
.ji-vision blockquote { margin: 0; font-size: clamp(18px, 2.6vw, 22px); font-weight: 600; line-height: 1.9; text-wrap: balance; }
.ji-welcome { background: var(--surface); border-radius: 20px; box-shadow: var(--shadow); padding: 22px 24px; display: flex; flex-direction: column; gap: 12px; }
.ji-welcome h2 { margin: 0; font-size: 20px; font-weight: 700; color: var(--ink); }
.ji-welcome p { margin: 0; color: var(--ink-2); line-height: 1.9; }
.ji-points { margin: 0; display: flex; flex-direction: column; }
.ji-points div { display: grid; grid-template-columns: 130px 1fr; gap: 12px; padding: 10px 0; border-top: 1px solid var(--line); }
.ji-points div:first-child { border-top: 0; }
.ji-points dt { font-weight: 600; color: var(--blue-ink); }
.ji-points dd { margin: 0; color: var(--ink); line-height: 1.8; }
.ji-cond { background: var(--surface); border-radius: 16px; box-shadow: var(--shadow); overflow: hidden; }
.ji-cond summary {
  list-style: none; display: flex; align-items: center; gap: 10px; min-height: 56px; padding: 0 20px; cursor: pointer;
  font-weight: 700; font-size: 16px; color: var(--ink);
}
.ji-cond summary::-webkit-details-marker { display: none; }
.ji-cond summary:focus-visible { outline: 2px solid var(--blue); outline-offset: -2px; border-radius: 16px; }
.ji-chev { margin-inline-start: auto; color: var(--ink-3); transition: transform .2s ease; }
.ji-cond[open] .ji-chev { transform: rotate(180deg); }
.ji-cond ol { margin: 0; padding: 4px 44px 18px 20px; display: flex; flex-direction: column; gap: 8px; color: var(--ink-2); line-height: 1.8; }
.ji-cond li::marker { color: var(--blue-ink); font-weight: 700; }
@media (max-width: 560px) {
  .ji-vision, .ji-welcome { padding: 18px 16px; }
  .ji-points div { grid-template-columns: 1fr; gap: 2px; }
}
@media (prefers-reduced-motion: reduce) { .ji-chev { transition: none; } }
</style>
