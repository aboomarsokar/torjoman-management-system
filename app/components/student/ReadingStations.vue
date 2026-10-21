<script setup lang="ts">
/**
 * محطّاتُ مقرّرات القراءة في تبويب الرحلة (للطالب ولملفّه عند العاملين): لكلّ مقرّرٍ كتبُه وصفحاتُه وحالُه
 * (اجتاز بأعلى نسبة / المستحقّ / لم يُبلغ) وعددُ محاولاته، وتنزيلُ ملفّ المجتاز والمستحقّ. البياناتُ من `useReadingPlan`.
 */
import { unitScope } from '~/utils/reading'

interface Props {
  studentId: string
  enrollmentDate: string | null
  /** العنوان — «كلّ المقرّرات» في صفحة البرامج المصاحبة نفسها. */
  heading?: string
}

const props = withDefaults(defineProps<Props>(), { heading: 'البرامج المصاحبة' })
const { journey } = useReadingPlan(() => ({ studentId: props.studentId, enrollmentDate: props.enrollmentDate }))
// التنزيلُ للمجتاز والمستحقّ (القاعدةُ تقصر الطالبَ عليهما على كلّ حال)
const { busy, download } = useReadingAdmin()
</script>

<template>
  <section
    class="rs"
    aria-labelledby="rs-title"
  >
    <h3 id="rs-title">
      <span class="ico"><UIcon
        name="i-lucide-library"
        class="size-5"
      /></span>
      {{ heading }}
    </h3>
    <p
      v-if="!journey.stations.length"
      class="none"
    >
      لم تُضبط مقرّرات البرامج المصاحبة بعد.
    </p>
    <ol v-else>
      <li
        v-for="s in journey.stations"
        :key="s.unit.id"
        class="st"
        :class="s.status"
      >
        <span class="dot"><UIcon
          v-if="s.status === 'passed'"
          name="i-lucide-check"
          class="size-[13px]"
        /></span>
        <div class="st-body">
          <div class="st-title">
            {{ s.unit.title }}
          </div>
          <div class="st-scope">
            {{ unitScope(s.unit) }}
          </div>
        </div>
        <UButton
          v-if="s.unit.pdfPath && s.status !== 'locked'"
          icon="i-lucide-download"
          color="neutral"
          variant="ghost"
          size="md"
          :loading="busy"
          :aria-label="`تنزيل ${s.unit.title}`"
          :title="`تنزيل ${s.unit.title}`"
          class="dl"
          :ui="{ base: 'min-h-11 min-w-11 rounded-xl justify-center' }"
          @click="download(s.unit)"
        />
        <span
          v-if="s.status === 'passed'"
          class="tag ok"
        >اجتاز · {{ s.best }}٪</span>
        <span
          v-else-if="s.status === 'due'"
          class="tag next"
        >المستحقّ<template v-if="s.attempts"> · {{ s.attempts }} محاولة</template></span>
        <span
          v-else
          class="tag soon"
        >لم يُبلغ</span>
      </li>
    </ol>
  </section>
</template>

<style scoped>
.rs { background: var(--surface); border: 1px solid var(--line); border-radius: 20px; padding: 24px; box-shadow: var(--shadow); margin-top: 22px; }
h3 { margin: 0 0 14px; font-size: 17px; font-weight: 700; color: var(--ink); display: flex; align-items: center; gap: 10px; }
.ico { width: 36px; height: 36px; border-radius: 11px; display: inline-flex; align-items: center; justify-content: center; flex: none; background: var(--blue-soft); color: var(--blue-ink); }
.none { margin: 0; font-size: 14px; color: var(--ink-3); }
ol { list-style: none; margin: 0; padding: 0; display: flex; flex-direction: column; }
.st { display: flex; align-items: center; gap: 12px; padding: 12px 0; border-bottom: 1px solid var(--line); }
.st:last-child { border-bottom: none; }
.dot { width: 22px; height: 22px; border-radius: 999px; background: var(--surface-3); border: 1px solid var(--line-2); display: inline-flex; align-items: center; justify-content: center; color: #fff; flex: none; }
.st.passed .dot { background: var(--green); border-color: var(--green); }
.st.due .dot { border-color: var(--blue); box-shadow: 0 0 0 3px var(--ring); }
.st-body { flex: 1; min-width: 0; }
.st-title { font-weight: 700; color: var(--ink); font-size: 15px; }
.st-scope { font-size: 13.5px; color: var(--ink-2); line-height: 1.6; margin-top: 2px; }
.tag { flex: none; display: inline-flex; align-items: center; min-height: 26px; padding: 2px 11px; border-radius: 999px; font-size: 12.5px; font-weight: 700; }
.tag.ok { background: var(--green-soft); color: var(--green-ink); }
.tag.next { background: var(--blue-soft); color: var(--blue-ink); }
.tag.soon { background: var(--surface-3); color: var(--ink-3); }
@media (max-width: 640px) { .rs { padding: 18px; } }
</style>
