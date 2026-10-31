<script setup lang="ts">
/**
 * المستنداتُ والمقرّراتُ العامة في المكتبة (طلب المستخدم 2026-10-31): مجموعةً بتصنيفها، لكلٍّ عنوانُه ووصفُه ونوعُه
 * وحجمُه، و«افتح» و«نزّل»؛ وشارةُ «الكادر وحده» لما خُفي عن الطلاب. المديرُ الإداريّ يعدّل ويحذف.
 */
import type { LibraryItem } from '~/composables/useLibrary'
import { DEFAULT_CATEGORY } from '~/constants/library'
import { fileSize, groupByCategory, libraryExt } from '~/utils/library'

const props = defineProps<{ items: LibraryItem[], canEdit: boolean }>()
const emit = defineEmits<{ open: [item: LibraryItem, download: boolean], edit: [item: LibraryItem], remove: [item: LibraryItem] }>()

const groups = computed(() => groupByCategory(props.items, DEFAULT_CATEGORY))
const ICONS: Record<string, string> = {
  pdf: 'i-lucide-file-text', jpg: 'i-lucide-image', png: 'i-lucide-image', webp: 'i-lucide-image',
  docx: 'i-lucide-file-type', xlsx: 'i-lucide-file-spreadsheet', pptx: 'i-lucide-presentation'
}
const kind = (i: LibraryItem) => libraryExt(i.file_name) ?? 'pdf'
</script>

<template>
  <div class="ld">
    <section
      v-for="g in groups"
      :key="g.category"
      class="ld-group"
    >
      <h2>{{ g.category }} <span>{{ g.items.length }}</span></h2>
      <ul>
        <li
          v-for="i in g.items"
          :key="i.id"
        >
          <span class="ld-ico"><UIcon
            :name="ICONS[kind(i)] ?? 'i-lucide-file'"
            class="size-5"
          /></span>
          <div class="ld-body">
            <b>{{ i.title }}</b>
            <p v-if="i.description">
              {{ i.description }}
            </p>
            <small>{{ kind(i).toUpperCase() }} · {{ fileSize(i.size_bytes) }}<UBadge
              v-if="i.audience === 'staff'"
              label="الكادر وحده"
              color="neutral"
              variant="soft"
              size="sm"
              class="ms-2"
            /></small>
          </div>
          <div class="ld-acts">
            <UButton
              label="افتح"
              icon="i-lucide-external-link"
              color="primary"
              variant="soft"
              :ui="{ base: 'rounded-[11px] min-h-11' }"
              @click="emit('open', i, false)"
            />
            <UButton
              icon="i-lucide-download"
              color="neutral"
              variant="soft"
              aria-label="نزّل"
              title="نزّل"
              :ui="{ base: 'rounded-[11px] min-h-11 min-w-11 justify-center' }"
              @click="emit('open', i, true)"
            />
            <template v-if="canEdit">
              <UButton
                icon="i-lucide-pencil"
                color="neutral"
                variant="ghost"
                aria-label="عدّل"
                title="عدّل"
                :ui="{ base: 'rounded-[11px] min-h-11 min-w-11 justify-center' }"
                @click="emit('edit', i)"
              />
              <UButton
                icon="i-lucide-trash-2"
                color="error"
                variant="ghost"
                aria-label="احذف"
                title="احذف"
                :ui="{ base: 'rounded-[11px] min-h-11 min-w-11 justify-center' }"
                @click="emit('remove', i)"
              />
            </template>
          </div>
        </li>
      </ul>
    </section>
  </div>
</template>

<style scoped>
.ld { display: flex; flex-direction: column; gap: 22px; }
.ld-group h2 { margin: 0 0 10px; font-size: 16px; font-weight: 700; color: var(--ink); display: flex; align-items: center; gap: 8px; }
.ld-group h2 span { font-size: 12.5px; font-weight: 600; color: var(--ink-3); background: var(--surface-2); border-radius: 999px; padding: 0 9px; font-variant-numeric: tabular-nums; }
.ld-group ul { list-style: none; margin: 0; padding: 0; display: flex; flex-direction: column; gap: 10px; }
.ld-group li { display: flex; align-items: center; gap: 14px; padding: 14px 16px; border-radius: 16px; background: var(--surface); box-shadow: var(--shadow-sm); flex-wrap: wrap; }
.ld-ico { display: grid; place-items: center; width: 44px; height: 44px; border-radius: 12px; background: var(--surface-2); color: var(--blue-ink); flex: none; }
.ld-body { flex: 1 1 220px; min-width: 0; display: flex; flex-direction: column; gap: 2px; }
.ld-body b { color: var(--ink); font-weight: 600; overflow-wrap: anywhere; }
.ld-body p { margin: 0; color: var(--ink-2); font-size: 14px; line-height: 1.7; }
.ld-body small { color: var(--ink-3); font-size: 12.5px; font-variant-numeric: tabular-nums; }
.ld-acts { display: flex; gap: 6px; flex-wrap: wrap; }
</style>
