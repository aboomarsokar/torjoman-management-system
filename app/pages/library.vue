<script setup lang="ts">
/**
 * مكتبةُ المشروع (طلب المستخدم 2026-10-31) — يصل إليها كلُّ أفراد المشروع: الطلابُ والمعلّمون والمشرفون والمختبِرون
 * والمديرون. تبويبان: الملازمُ الخمسَ عشرة، والمستنداتُ والمقرّرات (والطالبُ لا يرى ما جمهورُه «الكادر وحده»).
 * يرفع المديرُ الإداريّ وحده ويعدّل ويحذف (RLS على `library_items` والمستودع).
 */
import type { LibraryItem } from '~/composables/useLibrary'
import type { SegmentTab } from '~/components/ui/SegmentTabs.vue'
import type { LibraryDraft } from '~/utils/library'

definePageMeta({ layout: 'dashboard' })
useSeoMeta({ title: 'المكتبة — ترجمان' })

const { isAdmin } = usePermissions()
const api = useLibrary()
const { booklets, documents, loading, busy } = api
onMounted(() => void api.load())

type View = 'booklets' | 'docs'
const view = ref<View>('booklets')
const tabs = computed<SegmentTab<View>[]>(() => [
  { key: 'booklets', label: 'الملازم', icon: 'i-lucide-book-copy', count: booklets.value.size || undefined },
  { key: 'docs', label: 'المستندات والمقرّرات', icon: 'i-lucide-files', count: documents.value.length || undefined }
])
const categories = computed(() => [...new Set(documents.value.map(d => d.category))])

const docModal = reactive({ open: false, item: null as LibraryItem | null })
function openDoc(item: LibraryItem | null) {
  Object.assign(docModal, { open: true, item })
}
async function saveDoc(d: LibraryDraft, file: File | null) {
  if (await api.saveDocument(d, file, docModal.item ?? undefined)) docModal.open = false
}
const toRemove = ref<LibraryItem | null>(null)
async function remove() {
  if (toRemove.value && await api.remove(toRemove.value)) toRemove.value = null
}
</script>

<template>
  <main class="lib">
    <UiPageHeader
      title="المكتبة"
      subtitle="ملازمُ المشروع ومستنداتُه ومقرّراتُه — افتحها أو نزّلها"
    >
      <template
        v-if="isAdmin && view === 'docs'"
        #actions
      >
        <UButton
          label="أضف مستنداً"
          icon="i-lucide-plus"
          color="primary"
          size="lg"
          :ui="{ base: 'rounded-[13px] font-semibold min-h-11' }"
          @click="openDoc(null)"
        />
      </template>
    </UiPageHeader>

    <UiSegmentTabs
      v-model="view"
      :tabs="tabs"
      label="أقسام المكتبة"
    />

    <UiSkeletonCard
      v-if="loading && !booklets.size && !documents.length"
      :lines="4"
    />
    <LibraryBooklets
      v-else-if="view === 'booklets'"
      :files="booklets"
      :can-edit="isAdmin"
      :busy="busy"
      @open="api.open"
      @upload="api.uploadBooklet"
      @remove="(i: LibraryItem) => (toRemove = i)"
    />
    <UiEmptyState
      v-else-if="!documents.length"
      icon="i-lucide-files"
      title="لا مستنداتٍ بعد"
      :description="isAdmin ? 'أضف الأدلّة والنماذج والمقرّرات بزرّ «أضف مستنداً».' : 'ستظهر هنا المستنداتُ والمقرّراتُ حين تُرفع.'"
    />
    <LibraryDocuments
      v-else
      :items="documents"
      :can-edit="isAdmin"
      @open="api.open"
      @edit="openDoc"
      @remove="(i: LibraryItem) => (toRemove = i)"
    />

    <LibraryDocModal
      v-model:open="docModal.open"
      :item="docModal.item"
      :categories="categories"
      :busy="busy"
      @save="saveDoc"
    />
    <UiConfirmModal
      :open="!!toRemove"
      title="حذفٌ من المكتبة"
      :message="`سيُحذف «${toRemove?.title ?? ''}» وملفُّه نهائياً.`"
      :loading="busy"
      @update:open="(v: boolean) => { if (!v) toRemove = null }"
      @confirm="remove"
    />
  </main>
</template>

<style scoped>
.lib { display: flex; flex-direction: column; gap: 16px; }
</style>
