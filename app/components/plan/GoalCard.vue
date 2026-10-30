<script setup lang="ts">
/**
 * هدفٌ في خطة القسم وأنشطتُه (تصميم 2026-10-30): رأسٌ مميّزٌ بشريطٍ ملوّن فيه دائرةُ رقم الهدف وعنوانُه وحلقةُ إنجازه،
 * يُطوى بالضغط عليه (والهدفُ المنجزُ كلُّه يبدأ مطويّاً)، والتعديلُ والحذفُ في قائمة «⋯»، وأنشطتُه تحته.
 */
import type { DropdownMenuItem } from '@nuxt/ui'
import type { DeptGoal, DeptTask } from '~/composables/useDeptPlan'
import { progressOf, taskLabel } from '~/utils/deptPlan'

interface Props {
  goal: DeptGoal
  index: number
  tasks: DeptTask[]
  /** ترتيبُ كلّ نشاطٍ بين أنشطة هدفه كلّها (لا المعروضة فقط بعد التصفية). */
  taskIndex: Record<string, number>
  /** كلُّ أنشطة الهدف — لنسبة الإنجاز وإن صُفّيت المعروضة. */
  allTasks: DeptTask[]
  names: Record<string, string>
  today: string
  me: string | null
  canEdit: boolean
}
const props = defineProps<Props>()
const emit = defineEmits<{
  editGoal: [goal: DeptGoal]
  removeGoal: [goal: DeptGoal]
  addTask: [goalId: string]
  editTask: [task: DeptTask]
  removeTask: [task: DeptTask]
  status: [task: DeptTask]
}>()

const progress = computed(() => progressOf(props.allTasks))
const complete = computed(() => progress.value.total > 0 && progress.value.done === progress.value.total)
const collapsed = ref(complete.value)
watch(complete, (c) => {
  if (c) collapsed.value = true
})

// حلقةُ الإنجاز: محيطُ دائرةٍ نصفُ قطرها 20
const RING = 2 * Math.PI * 20
const dash = computed(() => `${(progress.value.pct / 100) * RING} ${RING}`)

const canUpdate = (t: DeptTask) => props.canEdit || (!!props.me && t.owners.includes(props.me))
const ownerNames = (t: DeptTask) => t.owners.map(id => props.names[id] ?? '—').join('، ') || 'بلا مسؤول'
const menu = computed<DropdownMenuItem[]>(() => [
  { label: 'نشاط جديد', icon: 'i-lucide-plus', onSelect: () => emit('addTask', props.goal.id) },
  { label: 'تعديل الهدف', icon: 'i-lucide-pencil', onSelect: () => emit('editGoal', props.goal) },
  { label: 'حذف الهدف', icon: 'i-lucide-trash-2', color: 'error', onSelect: () => emit('removeGoal', props.goal) }
])
</script>

<template>
  <article
    class="gc"
    :class="{ complete }"
  >
    <header class="gc-h">
      <button
        type="button"
        class="gc-toggle"
        :aria-expanded="!collapsed"
        :aria-controls="`goal-${goal.id}`"
        @click="collapsed = !collapsed"
      >
        <span class="gc-no">{{ index + 1 }}</span>
        <span class="gc-title">
          <span class="gc-kicker">الهدف {{ index + 1 }}<template v-if="complete"> · منجز</template></span>
          <span class="gc-name">{{ goal.title }}</span>
        </span>
        <span
          class="gc-ring"
          :aria-label="`الإنجاز ${progress.pct}%، ${progress.done} من ${progress.total}`"
        >
          <svg
            viewBox="0 0 48 48"
            aria-hidden="true"
          >
            <circle
              cx="24"
              cy="24"
              r="20"
              class="track"
            />
            <circle
              v-if="progress.pct > 0"
              cx="24"
              cy="24"
              r="20"
              class="fill"
              :stroke-dasharray="dash"
            />
          </svg>
          <b>{{ progress.pct }}%</b>
          <small>{{ progress.done }} من {{ progress.total }}</small>
        </span>
        <UIcon
          name="i-lucide-chevron-down"
          class="gc-chev size-5"
          :class="{ up: !collapsed }"
        />
      </button>
      <UDropdownMenu
        v-if="canEdit"
        :items="menu"
        :content="{ align: 'end' }"
      >
        <UButton
          icon="i-lucide-ellipsis-vertical"
          color="neutral"
          variant="ghost"
          aria-label="خيارات الهدف"
          :ui="{ base: 'min-h-11 min-w-11 justify-center text-(--band-ink) hover:bg-(--band-ink)/10' }"
        />
      </UDropdownMenu>
    </header>

    <div
      v-show="!collapsed"
      :id="`goal-${goal.id}`"
    >
      <ul class="gc-tasks">
        <PlanTaskItem
          v-for="t in tasks"
          :key="t.id"
          :task="t"
          :label="taskLabel(index, taskIndex[t.id] ?? 0)"
          :owner-names="ownerNames(t)"
          :today="today"
          :can-update="canUpdate(t)"
          :can-edit="canEdit"
          @status="emit('status', t)"
          @edit="emit('editTask', t)"
          @remove="emit('removeTask', t)"
        />
        <li
          v-if="!tasks.length"
          class="gc-empty"
        >
          لا أنشطة هنا.
        </li>
      </ul>
      <button
        v-if="canEdit"
        type="button"
        class="gc-add"
        @click="emit('addTask', goal.id)"
      >
        <UIcon
          name="i-lucide-plus"
          class="size-4"
        />
        نشاط جديد
      </button>
    </div>
  </article>
</template>

<style scoped>
.gc { background: var(--surface); border: 1px solid var(--line); border-radius: 16px; overflow: hidden; min-width: 0; }
.gc-h { display: flex; align-items: center; gap: 4px; background: var(--band); color: var(--band-ink); padding-inline-end: 6px; }
.gc-toggle {
  flex: 1; min-width: 0; display: flex; align-items: center; gap: 14px; padding: 14px 16px;
  background: none; border: 0; font: inherit; color: inherit; text-align: start; cursor: pointer;
}
.gc-toggle:focus-visible { outline: 2px solid var(--band-ink); outline-offset: -4px; border-radius: 14px; }
.gc-no {
  flex: none; width: 40px; height: 40px; border-radius: 50%; display: grid; place-items: center;
  background: var(--band-ink); color: var(--band); font-weight: 700; font-size: 17px; font-variant-numeric: tabular-nums;
}
.gc.complete .gc-no { background: var(--green); color: var(--band-ink); }
.gc-title { flex: 1; min-width: 0; display: flex; flex-direction: column; gap: 2px; }
.gc-kicker { font-size: 12px; font-weight: 600; color: var(--band-sub); }
.gc.complete .gc-kicker { color: var(--green); }
.gc-name { font-size: 18px; font-weight: 600; color: var(--band-ink); line-height: 1.55; text-wrap: balance; }
.gc-ring { flex: none; position: relative; width: 56px; display: grid; justify-items: center; }
.gc-ring svg { width: 48px; height: 48px; transform: rotate(-90deg); }
.gc-ring circle { fill: none; stroke-width: 5; }
.gc-ring .track { stroke: color-mix(in srgb, var(--band-ink) 22%, transparent); }
.gc-ring .fill { stroke: var(--green); stroke-linecap: round; transition: stroke-dasharray .4s var(--ease-out); }
.gc-ring b { position: absolute; top: 14px; font-size: 12px; color: var(--band-ink); font-variant-numeric: tabular-nums; }
.gc-ring small { font-size: 11px; color: var(--band-sub); white-space: nowrap; font-variant-numeric: tabular-nums; }
.gc-chev { color: var(--band-sub); transition: transform .2s var(--ease-out); flex: none; }
.gc-chev.up { transform: rotate(180deg); }
.gc-tasks { list-style: none; margin: 0; padding: 0; }
.gc-tasks > :first-child { border-top: 0; }
.gc-empty { padding: 12px 16px; color: var(--ink-3); font-size: 13px; }
.gc-add {
  display: flex; align-items: center; justify-content: center; gap: 6px; width: calc(100% - 28px); margin: 6px 14px 14px;
  min-height: 44px; border: 1.5px dashed var(--line-2); border-radius: 12px; background: none; color: var(--ink-3);
  font: inherit; font-weight: 600; cursor: pointer;
}
.gc-add:hover { border-color: var(--blue); color: var(--blue-ink); background: var(--blue-soft); }
.gc-add:focus-visible { outline: 2px solid var(--blue); outline-offset: 2px; }
@media (max-width: 640px) {
  .gc-toggle { gap: 10px; padding: 12px 10px 12px 4px; align-items: flex-start; }
  .gc-name { font-size: 16px; }
  .gc-no { width: 32px; height: 32px; font-size: 14px; }
  .gc-ring { width: 40px; }
  .gc-ring svg { width: 40px; height: 40px; }
  .gc-ring b { top: 12px; font-size: 11px; }
  .gc-ring small, .gc-chev { display: none; }
}
@media (prefers-reduced-motion: reduce) {
  .gc-chev, .gc-ring .fill { transition: none; }
}
</style>
