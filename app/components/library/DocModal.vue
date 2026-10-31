<script setup lang="ts">
/**
 * إضافةُ مستندٍ إلى المكتبة أو تعديلُه (المدير الإداريّ — طلب المستخدم 2026-10-31): العنوانُ والوصفُ والتصنيفُ (مقترحاتٌ
 * أو جديد) والجمهور (الجميع · الكادر وحده) والملفّ (إلزاميٌّ للجديد، واختياريٌّ للاستبدال عند التعديل).
 */
import type { LibraryItem } from '~/composables/useLibrary'
import {
  AUDIENCE_LABEL, DEFAULT_CATEGORY, LIBRARY_ACCEPT, LIBRARY_CATEGORIES, MAX_LIBRARY_DESCRIPTION, MAX_LIBRARY_TITLE, type LibraryAudience
} from '~/constants/library'
import { fileSize, type LibraryDraft } from '~/utils/library'

const props = defineProps<{ item: LibraryItem | null, categories: string[], busy: boolean }>()
const emit = defineEmits<{ save: [draft: LibraryDraft, file: File | null] }>()
const open = defineModel<boolean>('open', { required: true })

const form = reactive<LibraryDraft>({ title: '', description: '', category: DEFAULT_CATEGORY, audience: 'all' })
const file = ref<File | null>(null)
const picker = ref<HTMLInputElement | null>(null)
watch(open, (o) => {
  if (!o) return
  const i = props.item
  Object.assign(form, i
    ? { title: i.title, description: i.description ?? '', category: i.category, audience: i.audience as LibraryAudience }
    : { title: '', description: '', category: DEFAULT_CATEGORY, audience: 'all' })
  file.value = null
})
const categoryItems = computed(() => [...new Set([...LIBRARY_CATEGORIES, ...props.categories])])
const audienceItems = (Object.keys(AUDIENCE_LABEL) as LibraryAudience[]).map(v => ({ label: AUDIENCE_LABEL[v], value: v }))
function onFile(e: Event) {
  const input = e.target as HTMLInputElement
  file.value = input.files?.[0] ?? null
  if (file.value && !form.title.trim()) form.title = file.value.name.replace(/\.[^.]+$/, '')
}
</script>

<template>
  <UModal
    v-model:open="open"
    :title="item ? 'تعديلُ المستند' : 'إضافةُ مستندٍ إلى المكتبة'"
  >
    <template #body>
      <div class="dm">
        <UFormField :label="item ? 'استبدل الملفّ (اختياريّ)' : 'الملفّ'">
          <input
            ref="picker"
            type="file"
            :accept="LIBRARY_ACCEPT"
            class="sr-only"
            aria-label="اختر الملفّ"
            @change="onFile"
          >
          <button
            type="button"
            class="dm-file"
            @click="picker?.click()"
          >
            <UIcon
              :name="file ? 'i-lucide-file-check' : 'i-lucide-upload'"
              class="size-5"
            />
            <span>{{ file ? `${file.name} · ${fileSize(file.size)}` : 'اختر الملفّ من جهازك' }}</span>
          </button>
          <template #help>
            PDF أو صورة أو Word أو Excel أو PowerPoint، حتى 50 ميغا.
            <template v-if="item && !file">
              الحاليّ: {{ item.file_name }} ({{ fileSize(item.size_bytes) }})
            </template>
          </template>
        </UFormField>
        <UFormField label="العنوان">
          <UInput
            v-model="form.title"
            :maxlength="MAX_LIBRARY_TITLE"
            size="xl"
            class="w-full"
            :ui="{ base: 'rounded-[12px] min-h-12' }"
          />
        </UFormField>
        <UFormField label="الوصف (اختياريّ)">
          <UTextarea
            v-model="form.description"
            :rows="2"
            autoresize
            :maxlength="MAX_LIBRARY_DESCRIPTION"
            class="w-full"
          />
        </UFormField>
        <div class="dm-row">
          <UFormField label="التصنيف">
            <UInputMenu
              v-model="form.category"
              :items="categoryItems"
              create-item
              size="xl"
              class="w-full"
              :ui="{ base: 'rounded-[12px] min-h-12' }"
              @create="(v: string) => (form.category = v)"
            />
          </UFormField>
          <UFormField label="يراه">
            <UiSelect
              v-model="form.audience"
              :items="audienceItems"
              size="xl"
              class="w-full"
              :ui="{ base: 'rounded-[12px] min-h-12' }"
            />
          </UFormField>
        </div>
      </div>
    </template>
    <template #footer>
      <div class="flex w-full justify-end gap-2">
        <UButton
          label="إلغاء"
          color="neutral"
          variant="ghost"
          :ui="{ base: 'rounded-[12px] min-h-11' }"
          @click="open = false"
        />
        <UButton
          :label="item ? 'احفظ' : 'أضف'"
          icon="i-lucide-check"
          color="primary"
          :loading="busy"
          :ui="{ base: 'rounded-[12px] min-h-11 font-semibold' }"
          @click="emit('save', { ...form }, file)"
        />
      </div>
    </template>
  </UModal>
</template>

<style scoped>
.dm { display: flex; flex-direction: column; gap: 14px; }
.dm-row { display: grid; grid-template-columns: repeat(auto-fit, minmax(180px, 1fr)); gap: 12px; }
.dm-file { display: flex; align-items: center; gap: 10px; width: 100%; min-height: 48px; padding: 10px 14px; border-radius: 12px; border: 1px dashed var(--line); background: var(--surface-2); color: var(--ink-2); cursor: pointer; text-align: start; overflow-wrap: anywhere; }
.dm-file:hover { border-color: var(--blue); color: var(--ink); }
</style>
