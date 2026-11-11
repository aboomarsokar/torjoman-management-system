<script setup lang="ts">
/**
 * مقرّراتُ البرامج المصاحبة للعاملين — كلُّ مقرّرٍ بكتبه وصفحاته وتنزيلِ ملفّه. وللمديرَين (`manage`): رفعُ الملفّ
 * أو استبدالُه، وإضافةُ مقرّرٍ في آخر الخطّة (ReadingAddUnitModal) وكتابٍ جديد (ReadingAddBookModal).
 * شبكةُ بطاقاتٍ بعرض الصفحة بأغلفتها، ومقرّرُ الشهر الجاري مميَّز (2026-11-11).
 */
import { monthUnit, unitMonthLabel, unitScope } from '~/utils/reading'
import { gazaToday } from '~/utils/reportWindow'

interface Props {
  /** المديرُ الإداريّ والمديرُ الفنيّ: الرفعُ والإضافة. */
  manage: boolean
}

defineProps<Props>()
const { units, refreshUnits, coverUrls } = useReadingUnits()
const currentId = computed(() => monthUnit(units.value ?? [], gazaToday())?.id ?? null)
const { busy, download, uploadPdf, uploadCover, deleteUnit } = useReadingAdmin()
// الحذفُ للمدير الإداري وحده (سياسةُ reading_units)، وللمقرّر الأخير وحدَه (2026-10-25)
const { isAdmin } = usePermissions()
const lastId = computed(() => (units.value ?? []).reduce<{ id: number, o: number } | null>(
  (m, u) => !m || u.sort_order > m.o ? { id: u.id, o: u.sort_order } : m, null)?.id ?? null)
type UnitItem = NonNullable<typeof units.value>[number]
const deleteTarget = ref<UnitItem | null>(null)
const deleteOpen = computed({
  get: () => !!deleteTarget.value,
  set: (v) => {
    if (!v) deleteTarget.value = null
  }
})
async function confirmDelete() {
  if (deleteTarget.value && await deleteUnit(deleteTarget.value)) {
    deleteTarget.value = null
    await refreshUnits()
  }
}

const fileInput = ref<HTMLInputElement | null>(null)
const coverInput = ref<HTMLInputElement | null>(null)
const target = ref<number | null>(null)
const addUnitOpen = ref(false)
const addBookOpen = ref(false)

function pickFor(unitId: number, kind: 'pdf' | 'cover') {
  target.value = unitId
  ;(kind === 'pdf' ? fileInput : coverInput).value?.click()
}

async function onPick(event: Event, kind: 'pdf' | 'cover') {
  const input = event.target as HTMLInputElement
  const file = input.files?.[0]
  if (file && target.value !== null && await (kind === 'pdf' ? uploadPdf : uploadCover)(target.value, file)) await refreshUnits()
  input.value = ''
}

const nextOrder = computed(() => Math.max(0, ...(units.value ?? []).map(u => u.sort_order)) + 1)
</script>

<template>
  <section
    class="ul"
    aria-labelledby="ul-title"
  >
    <h2
      id="ul-title"
      class="sr-only"
    >
      المقرّرات
    </h2>
    <input
      ref="fileInput"
      type="file"
      accept="application/pdf"
      class="hidden"
      @change="onPick($event, 'pdf')"
    >
    <input
      ref="coverInput"
      type="file"
      accept="image/jpeg,image/png,image/webp"
      class="hidden"
      @change="onPick($event, 'cover')"
    >
    <p
      v-if="!units?.length"
      class="none"
    >
      لا مقرّرات بعد.
    </p>
    <ol
      v-else
      class="grid"
    >
      <li
        v-for="u in units"
        :key="u.id"
        class="card"
        :class="{ now: u.id === currentId }"
        :aria-current="u.id === currentId ? 'date' : undefined"
      >
        <div class="top">
          <img
            v-if="coverUrls[u.id]"
            :src="coverUrls[u.id]"
            :alt="`غلاف ${u.title}`"
            class="thumb"
            loading="lazy"
          >
          <span
            v-else
            class="thumb ph"
            aria-hidden="true"
          >{{ u.sort_order }}</span>
          <div class="body">
            <span
              v-if="u.id === currentId"
              class="now-tag"
            >مقرّر هذا الشهر</span>
            <h3 class="title">
              {{ u.title }}
            </h3>
            <div
              v-if="u.opensOn"
              class="month"
            >
              {{ unitMonthLabel(u.opensOn) }}
            </div>
            <div class="scope">
              {{ unitScope(u) }}
            </div>
            <div
              v-if="!u.pdfPath"
              class="missing"
            >
              <UIcon
                name="i-lucide-file-x"
                class="size-4"
              /> لم يُرفع ملفّه بعد
            </div>
          </div>
        </div>
        <div
          v-if="u.pdfPath || manage"
          class="acts"
        >
          <UButton
            v-if="u.pdfPath"
            label="تنزيل"
            icon="i-lucide-download"
            color="neutral"
            variant="outline"
            :loading="busy"
            :ui="{ base: 'min-h-11 rounded-xl justify-center' }"
            @click="download(u)"
          />
          <UButton
            v-if="manage"
            :label="u.pdfPath ? 'استبدال الملفّ' : 'رفع الملفّ'"
            icon="i-lucide-upload"
            :color="u.pdfPath ? 'neutral' : 'primary'"
            :variant="u.pdfPath ? 'ghost' : 'solid'"
            :loading="busy && target === u.id"
            :ui="{ base: 'min-h-11 rounded-xl justify-center' }"
            @click="pickFor(u.id, 'pdf')"
          />
          <UButton
            v-if="manage"
            :label="u.coverPath ? 'استبدال الغلاف' : 'رفع الغلاف'"
            icon="i-lucide-image"
            color="neutral"
            variant="ghost"
            :ui="{ base: 'min-h-11 rounded-xl justify-center' }"
            @click="pickFor(u.id, 'cover')"
          />
          <UButton
            v-if="manage && isAdmin && u.id === lastId"
            label="حذف المقرّر"
            icon="i-lucide-trash-2"
            color="error"
            variant="ghost"
            :ui="{ base: 'min-h-11 rounded-xl justify-center' }"
            @click="deleteTarget = u"
          />
        </div>
      </li>
    </ol>

    <div
      v-if="manage"
      class="add"
    >
      <UButton
        label="إضافة مقرّر"
        icon="i-lucide-plus"
        color="primary"
        :ui="{ base: 'min-h-11 rounded-xl font-semibold justify-center' }"
        @click="addUnitOpen = true"
      />
      <UButton
        label="إضافة كتاب"
        icon="i-lucide-book-plus"
        color="neutral"
        variant="outline"
        :ui="{ base: 'min-h-11 rounded-xl justify-center' }"
        @click="addBookOpen = true"
      />
      <p class="hint">
        يُضاف المقرّر في آخر الخطّة، ثم يُرفع ملفّه وغلافُه (صورةُ زرّ التنزيل). وبنكُ أسئلته يُدخل من ملفّ Excel.
      </p>
    </div>

    <ReadingAddUnitModal
      v-if="manage"
      v-model:open="addUnitOpen"
      :next-order="nextOrder"
      @added="refreshUnits"
    />
    <ReadingAddBookModal
      v-if="manage"
      v-model:open="addBookOpen"
    />
    <UiConfirmModal
      v-model:open="deleteOpen"
      :title="`حذف ${deleteTarget?.title ?? 'المقرّر'}؟`"
      message="يُحذف المقرّرُ وأجزاؤه وأسئلةُ بنكه، وملفُّه وغلافُه. لا يمكن التراجع. ولا يُحذف إن كان عليه اختبارٌ لطالب."
      confirm-label="احذف المقرّر"
      :loading="busy"
      @confirm="confirmDelete"
    />
  </section>
</template>

<style scoped>
.ul { container-type: inline-size; }
.none { margin: 16px 0 0; color: var(--ink-3); }
.grid { list-style: none; margin: 0; padding: 0; display: grid; grid-template-columns: repeat(auto-fill, minmax(min(100%, 360px), 1fr)); gap: 16px; }
.card { display: flex; flex-direction: column; gap: 14px; background: var(--surface); border: 1px solid var(--line); border-radius: 16px; padding: 16px; box-shadow: var(--shadow); }
.card.now { border-color: var(--blue); box-shadow: 0 0 0 1px var(--blue), var(--shadow); }
.top { display: flex; gap: 14px; align-items: flex-start; flex: 1; }
.thumb { flex: none; width: 64px; height: 86px; object-fit: cover; border-radius: 8px; border: 1px solid var(--line); }
.ph { display: inline-flex; align-items: center; justify-content: center; background: var(--blue-soft); color: var(--blue-ink); font-size: 22px; font-weight: 700; border-color: transparent; }
.body { flex: 1; min-width: 0; display: flex; flex-direction: column; gap: 2px; }
.now-tag { align-self: flex-start; display: inline-flex; align-items: center; min-height: 22px; padding: 0 9px; margin-bottom: 4px; border-radius: 999px; background: var(--blue); color: var(--surface); font-size: 12px; font-weight: 600; }
.title { margin: 0; font-weight: 600; color: var(--ink); font-size: 16px; }
.month { font-size: 13px; color: var(--ink-3); }
.scope { font-size: 14px; color: var(--ink-2); line-height: 1.6; margin-top: 4px; }
.missing { display: inline-flex; align-items: center; gap: 5px; font-size: 13px; color: var(--err); font-weight: 600; margin-top: 4px; }
.acts { display: flex; gap: 6px; flex-wrap: wrap; padding-top: 12px; border-top: 1px solid var(--line); }
.add { margin-top: 18px; padding: 16px 18px; background: var(--surface); border: 1px dashed var(--line); border-radius: 16px; display: flex; flex-wrap: wrap; align-items: center; gap: 10px; }
.hint { margin: 0; flex: 1 1 320px; font-size: 13px; color: var(--ink-3); }
@container (max-width: 520px) {
  .acts > * { flex: 1 1 0; }
}
</style>
