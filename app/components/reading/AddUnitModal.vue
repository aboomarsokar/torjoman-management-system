<script setup lang="ts">
/**
 * إضافةُ مقرّرٍ في آخر خطّة البرامج المصاحبة (للمديرَين) — جزءٌ أو أكثر: كتابٌ ومن صفحة إلى صفحة.
 * التحقّقُ في `partsError`، والحفظُ في `useReadingAdmin.addUnit`.
 */
import type { Database } from '~/types/database.types'
import { partsError, unitTitle, type PartDraft } from '~/composables/useReadingAdmin'

interface Props {
  /** ترتيبُ المقرّر الجديد (بعد آخرها). */
  nextOrder: number
}

const props = defineProps<Props>()
const open = defineModel<boolean>('open', { required: true })
const emit = defineEmits<{ added: [] }>()

const supabase = useSupabaseClient<Database>()
const { busy, addUnit } = useReadingAdmin()
const toast = useToast()

const { data: books, refresh: refreshBooks } = useLazyAsyncData('reading-books', async () => {
  const { data } = await supabase.from('reading_books').select('id, title, pages').order('id')
  return data ?? []
}, { server: false, default: () => [] })
const bookItems = computed(() => (books.value ?? []).map(b => ({ label: b.pages ? `${b.title} (${b.pages} ص)` : b.title, value: b.id })))

const parts = ref<PartDraft[]>([])
watch(open, (o) => {
  if (!o) return
  void refreshBooks()
  parts.value = [{ bookId: undefined, from: '', to: '' }]
})

async function save() {
  const invalid = partsError(parts.value, books.value ?? [])
  if (invalid) {
    toast.add({ title: invalid, color: 'error', icon: 'i-lucide-circle-alert' })
    return
  }
  if (await addUnit(props.nextOrder, parts.value)) {
    open.value = false
    emit('added')
  }
}
</script>

<template>
  <UModal
    v-model:open="open"
    :title="`إضافة ${unitTitle(nextOrder)}`"
    description="اختر الكتاب والصفحات المقرّرة. وإن كان المقرّر من كتابين فأضف جزءاً ثانياً."
  >
    <template #body>
      <div class="parts">
        <div
          v-for="(p, i) in parts"
          :key="i"
          class="part"
        >
          <UFormField :label="`الكتاب${parts.length > 1 ? ` ${i + 1}` : ''}`">
            <UiSelect
              v-model="p.bookId"
              :items="bookItems"
              placeholder="اختر الكتاب"
              size="lg"
            />
          </UFormField>
          <div class="pages">
            <UFormField label="من صفحة">
              <UInput
                v-model="p.from"
                inputmode="numeric"
                size="lg"
                class="w-full"
                :ui="{ base: 'rounded-[13px]' }"
              />
            </UFormField>
            <UFormField label="إلى صفحة">
              <UInput
                v-model="p.to"
                inputmode="numeric"
                size="lg"
                class="w-full"
                :ui="{ base: 'rounded-[13px]' }"
              />
            </UFormField>
            <UButton
              v-if="parts.length > 1"
              icon="i-lucide-trash-2"
              color="neutral"
              variant="ghost"
              aria-label="حذف الجزء"
              class="rm"
              :ui="{ base: 'min-h-11 min-w-11 justify-center' }"
              @click="parts.splice(i, 1)"
            />
          </div>
        </div>
        <UButton
          label="جزءٌ من كتابٍ آخر"
          icon="i-lucide-plus"
          color="neutral"
          variant="ghost"
          class="self-start"
          @click="parts.push({ bookId: undefined, from: '', to: '' })"
        />
      </div>
    </template>
    <template #footer>
      <div class="foot">
        <UButton
          label="إلغاء"
          color="neutral"
          variant="ghost"
          class="min-h-11"
          @click="open = false"
        />
        <UButton
          label="إضافة"
          icon="i-lucide-check"
          color="primary"
          :loading="busy"
          class="min-h-11"
          :ui="{ base: 'rounded-[13px] font-semibold' }"
          @click="save"
        />
      </div>
    </template>
  </UModal>
</template>

<style scoped>
.parts { display: flex; flex-direction: column; gap: 14px; }
.part { display: flex; flex-direction: column; gap: 10px; padding: 12px; border: 1px solid var(--line); border-radius: 14px; background: var(--surface-2); }
.pages { display: grid; grid-template-columns: 1fr 1fr auto; gap: 10px; align-items: end; }
.foot { display: flex; justify-content: flex-end; gap: 10px; width: 100%; }
</style>
