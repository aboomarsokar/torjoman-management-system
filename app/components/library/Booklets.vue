<script setup lang="ts">
/**
 * ملازمُ المشروع الخمسَ عشرة في المكتبة (طلب المستخدم 2026-10-31): بطاقةٌ لكلّ ملزمة بترتيبها (الجزء 29 + 30 … 1 + 2)،
 * فيها «افتح» و«نزّل» إن رُفع ملفُّها، والمديرُ الإداريّ يرفع ملفَّ PDF أو يستبدله أو يحذفه.
 */
import { BOOKLETS } from '~/constants/booklets'
import type { LibraryItem } from '~/composables/useLibrary'
import { fileSize } from '~/utils/library'

defineProps<{ files: Map<number, LibraryItem>, canEdit: boolean, busy: boolean }>()
const emit = defineEmits<{ open: [item: LibraryItem, download: boolean], upload: [no: number, file: File], remove: [item: LibraryItem] }>()

const picker = ref<HTMLInputElement | null>(null)
const target = ref(0)
function pick(no: number) {
  target.value = no
  picker.value?.click()
}
function onPicked(e: Event) {
  const input = e.target as HTMLInputElement
  const file = input.files?.[0]
  if (file && target.value) emit('upload', target.value, file)
  input.value = ''
}
</script>

<template>
  <div class="lb">
    <input
      ref="picker"
      type="file"
      accept=".pdf,application/pdf"
      class="sr-only"
      aria-label="اختر ملفّ الملزمة"
      @change="onPicked"
    >
    <article
      v-for="b in BOOKLETS"
      :key="b.no"
      class="lb-card"
      :class="{ empty: !files.get(b.no) }"
    >
      <small>الملزمة {{ b.no }}</small>
      <h3>{{ b.label }}</h3>
      <p
        v-if="files.get(b.no)"
        class="lb-meta"
      >
        PDF · {{ fileSize(files.get(b.no)!.size_bytes) }}
      </p>
      <p
        v-else
        class="lb-meta"
      >
        لم تُرفع بعد
      </p>
      <div class="lb-acts">
        <template v-if="files.get(b.no)">
          <UButton
            label="افتح"
            icon="i-lucide-book-open"
            color="primary"
            variant="soft"
            :ui="{ base: 'rounded-[11px] min-h-11' }"
            @click="emit('open', files.get(b.no)!, false)"
          />
          <UButton
            icon="i-lucide-download"
            color="neutral"
            variant="soft"
            aria-label="نزّل الملزمة"
            title="نزّل"
            :ui="{ base: 'rounded-[11px] min-h-11 min-w-11 justify-center' }"
            @click="emit('open', files.get(b.no)!, true)"
          />
        </template>
        <template v-if="canEdit">
          <UButton
            :label="files.get(b.no) ? undefined : 'ارفع PDF'"
            :icon="files.get(b.no) ? 'i-lucide-replace' : 'i-lucide-upload'"
            color="neutral"
            :variant="files.get(b.no) ? 'ghost' : 'outline'"
            :aria-label="files.get(b.no) ? 'استبدل الملفّ' : 'ارفع PDF'"
            :title="files.get(b.no) ? 'استبدل الملفّ' : undefined"
            :loading="busy && target === b.no"
            :ui="{ base: 'rounded-[11px] min-h-11 min-w-11 justify-center' }"
            @click="pick(b.no)"
          />
          <UButton
            v-if="files.get(b.no)"
            icon="i-lucide-trash-2"
            color="error"
            variant="ghost"
            aria-label="احذف ملفّ الملزمة"
            title="احذف"
            :ui="{ base: 'rounded-[11px] min-h-11 min-w-11 justify-center' }"
            @click="emit('remove', files.get(b.no)!)"
          />
        </template>
      </div>
    </article>
  </div>
</template>

<style scoped>
.lb { display: grid; grid-template-columns: repeat(auto-fill, minmax(min(100%, 220px), 1fr)); gap: 14px; }
.lb-card { display: flex; flex-direction: column; gap: 4px; padding: 16px 18px; border-radius: 18px; background: var(--surface); box-shadow: var(--shadow-sm); }
.lb-card.empty { background: var(--surface-2); box-shadow: none; }
.lb-card small { color: var(--ink-3); font-size: 12.5px; }
.lb-card h3 { margin: 0; font-size: 17px; font-weight: 700; color: var(--ink); }
.lb-meta { margin: 0 0 8px; font-size: 13px; color: var(--ink-3); font-variant-numeric: tabular-nums; }
.lb-acts { display: flex; flex-wrap: wrap; gap: 6px; margin-top: auto; }
</style>
