<script setup lang="ts">
/**
 * مقرّراتُ البرامج المصاحبة للعاملين — كلُّ مقرّرٍ بكتبه وصفحاته وتنزيلِ ملفّه. وللمديرَين (`manage`): رفعُ الملفّ
 * أو استبدالُه، وإضافةُ مقرّرٍ في آخر الخطّة (ReadingAddUnitModal) وكتابٍ جديد (ReadingAddBookModal).
 */
import { unitScope } from '~/utils/reading'

interface Props {
  /** المديرُ الإداريّ والمديرُ الفنيّ: الرفعُ والإضافة. */
  manage: boolean
}

defineProps<Props>()
const { units, refreshUnits, coverUrls } = useReadingUnits()
const { busy, download, uploadPdf, uploadCover } = useReadingAdmin()

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
  <section class="ul">
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
    <ol v-else>
      <li
        v-for="u in units"
        :key="u.id"
        class="row"
      >
        <img
          v-if="coverUrls[u.id]"
          :src="coverUrls[u.id]"
          alt=""
          class="thumb"
          loading="lazy"
        >
        <span
          v-else
          class="n"
        >{{ u.sort_order }}</span>
        <div class="body">
          <div class="title">
            {{ u.title }}
          </div>
          <div class="scope">
            {{ unitScope(u) }}
          </div>
          <div
            v-if="!u.pdfPath"
            class="missing"
          >
            لم يُرفع ملفّه بعد
          </div>
        </div>
        <div class="acts">
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
  </section>
</template>

<style scoped>
.ul { background: var(--surface); border: 1px solid var(--line); border-radius: 20px; box-shadow: var(--shadow); padding: 8px 20px 20px; }
.none { margin: 16px 0 0; color: var(--ink-3); }
ol { list-style: none; margin: 0; padding: 0; }
.row { display: flex; align-items: center; gap: 14px; padding: 14px 0; border-bottom: 1px solid var(--line); flex-wrap: wrap; }
.row:last-child { border-bottom: none; }
.thumb { flex: none; width: 46px; height: 60px; object-fit: cover; border-radius: 8px; border: 1px solid var(--line); }
.n { flex: none; width: 34px; height: 34px; border-radius: 10px; background: var(--blue-soft); color: var(--blue-ink); font-weight: 800; display: inline-flex; align-items: center; justify-content: center; }
.body { flex: 1 1 220px; min-width: 0; }
.title { font-weight: 700; color: var(--ink); font-size: 15.5px; }
.scope { font-size: 14px; color: var(--ink-2); line-height: 1.7; }
.missing { font-size: 13px; color: var(--err); font-weight: 600; margin-top: 2px; }
.acts { display: flex; gap: 8px; flex-wrap: wrap; }
.add { margin-top: 16px; padding-top: 16px; border-top: 1px solid var(--line); display: flex; flex-wrap: wrap; align-items: center; gap: 10px; }
.hint { margin: 0; flex: 1 1 100%; font-size: 13px; color: var(--ink-3); }
@media (max-width: 560px) {
  .ul { padding: 4px 14px 16px; }
  .acts { width: 100%; }
  .acts > * { flex: 1 1 0; }
}
</style>
