<script setup lang="ts">
/**
 * أرشيفُ الملازم (طلب المستخدم 2026-10-21) — ما استلمته كلُّ حلقةٍ من ملازم المشروع الخمسَ عشرة
 * (الجزء 29 + 30 … 1 + 2) بنُسخها وتواريخها، لإحصاء العدد. المديرُ الإداريّ يسجّل ويحذف، ومشرفُ المشروع
 * يقرأ (RLS على `booklet_deliveries`). العروض: حسب الحلقة · حسب الملزمة · السجلّ · الطلبات · المخزون (2026-10-28 —
 * رصيدُ كلّ ملزمةٍ يُخصم مع التسليم، والتسليمُ يُرفض إن لم يكفِ، وتنبيهٌ عند قرب النفاد).
 */
import type { DeliveryDraft } from '~/composables/useBooklets'
import type { DeliveryRow } from '~/utils/booklets'
import { bookletStats, halaqaBooklets, totalsByBooklet } from '~/utils/booklets'
import type { StockAction, StockDraft, StockMove } from '~/composables/useBookletStock'
import { stockItems } from '~/utils/bookletStock'
import { bookletReadyDraft } from '~/utils/chatDrafts'
import type { SegmentTab } from '~/components/ui/SegmentTabs.vue'
import type { BookletRequest } from '~/composables/useBookletRequests'

definePageMeta({ layout: 'dashboard' })
useSeoMeta({ title: 'أرشيف الملازم — ترجمان' })

type View = 'halaqa' | 'booklet' | 'log' | 'requests' | 'stock'

const { role, isAdmin, isReadOnly } = usePermissions()
const canView = computed(() => isAdmin.value || isReadOnly.value)
const { deliveries, halaqat, pending, busy, addDelivery, removeDelivery, refresh: refreshDeliveries } = useBooklets()
// طلباتُ المعلّمين (2026-10-25) — إشعارُ الطلب يفتح هذا العرض (?view=requests)، والعددُ للمفتوحة الجديدة
const { requests, openCount, busy: reqBusy, deliverRequest } = useBookletRequests()
/** «تمّ التسليم» يسجّل التسليمَ في الأرشيف — فتُحدَّث الأرقامُ والعروضُ معه. */
async function deliver(id: string, deliveredOn: string) {
  const booklet = requests.value?.find(r => r.id === id)?.booklet
  if (await deliverRequest(id, deliveredOn)) {
    await refreshDeliveries()
    if (booklet) await stockApi.afterDelivery(booklet)
  }
}

const { openWithDraft } = useChatList()
const stockApi = useBookletStock()
const { stock, moves, busy: stockBusy, lowCount } = stockApi
onMounted(() => {
  void stockApi.refreshStock()
  void stockApi.refreshMoves()
})
const items = computed(() => stockItems(stock.value))
const stockModal = reactive({ open: false, booklet: null as number | null, action: 'supply' as StockAction })
function openStock(booklet: number, action: StockAction) {
  Object.assign(stockModal, { open: true, booklet, action })
}
const stockItem = computed(() => items.value.find(i => i.no === stockModal.booklet))
async function saveStock(d: StockDraft) {
  if (await stockApi.save(d)) stockModal.open = false
}
const editMove = ref<StockMove | null>(null)
const editOpen = ref(false)
function openEdit(m: StockMove) {
  editMove.value = m
  editOpen.value = true
}
async function saveMove(id: string, note: string, movedOn: string | null) {
  if (await stockApi.updateMove(id, note, movedOn)) editOpen.value = false
}

const route = useRoute()
const view = ref<View>(route.query.view === 'requests' ? 'requests' : route.query.view === 'stock' ? 'stock' : 'halaqa')
/** عروضُ الصفحة تبويباتٍ مقطّعةً بأيقوناتها (طلب المستخدم 2026-10-28: بدل شرائح الفلترة). */
const viewTabs = computed<SegmentTab<View>[]>(() => [
  { key: 'halaqa', label: 'حسب الحلقة', icon: 'i-lucide-users-round' },
  { key: 'booklet', label: 'حسب الملزمة', icon: 'i-lucide-book-copy' },
  { key: 'log', label: 'السجلّ', icon: 'i-lucide-history', count: deliveries.value.length },
  { key: 'requests', label: 'الطلبات', icon: 'i-lucide-inbox', count: openCount.value || undefined },
  { key: 'stock', label: 'المخزون', icon: 'i-lucide-package', count: lowCount.value || undefined }
])

const stats = computed(() => bookletStats(deliveries.value, halaqat.value.length))
const byHalaqa = computed(() => halaqaBooklets(deliveries.value, halaqat.value))
const byBooklet = computed(() => totalsByBooklet(deliveries.value))
const halaqaNames = computed(() => Object.fromEntries(halaqat.value.map(h => [h.id, h.name])))

const modalOpen = ref(false)
async function save(draft: DeliveryDraft, today: string) {
  if (await addDelivery(draft, today)) {
    modalOpen.value = false
    if (draft.booklet) await stockApi.afterDelivery(draft.booklet)
  }
}

const deleteTarget = ref<DeliveryRow | null>(null)
async function confirmDelete() {
  if (deleteTarget.value && await removeDelivery(deleteTarget.value.id)) {
    deleteTarget.value = null
    await stockApi.refreshStock()
  }
}
</script>

<template>
  <div
    class="booklets"
    :class="{ fit: view === 'log' && deliveries.length > 0 }"
  >
    <UiPageHeader
      title="أرشيف الملازم"
      subtitle="ما استلمته كلّ حلقة من ملازم المشروع، من الجزء 29 + 30 إلى الجزء 1 + 2."
    >
      <template
        v-if="isAdmin"
        #actions
      >
        <UButton
          label="تسليم جديد"
          color="primary"
          size="lg"
          icon="i-lucide-plus"
          :ui="{ base: 'rounded-[13px] font-semibold min-h-11' }"
          @click="modalOpen = true"
        />
      </template>
    </UiPageHeader>

    <UiEmptyState
      v-if="role && !canView"
      icon="i-lucide-lock"
      title="هذه الصفحة للمدير الإداري فقط."
    />

    <ClientOnly v-else-if="canView">
      <div
        v-if="pending"
        class="stack"
      >
        <UiSkeletonRow
          v-for="i in 4"
          :key="i"
          :action="false"
        />
      </div>
      <template v-else>
        <UiStatStrip
          :items="stats"
          label="أرقام الملازم"
        />
        <UiSegmentTabs
          v-model="view"
          :tabs="viewTabs"
          label="عروض أرشيف الملازم"
          class="views"
        />
        <BookletsByHalaqa
          v-if="view === 'halaqa'"
          :rows="byHalaqa"
        />
        <BookletsByBooklet
          v-else-if="view === 'booklet'"
          :rows="byBooklet"
        />
        <BookletsStock
          v-else-if="view === 'stock'"
          :items="items"
          :moves="moves"
          :halaqa-names="halaqaNames"
          :can-edit="isAdmin"
          @act="openStock"
          @edit="openEdit"
        />
        <BookletsRequests
          v-else-if="view === 'requests'"
          :rows="requests ?? []"
          :can-close="isAdmin"
          :busy="reqBusy"
          @deliver="deliver"
          @chat="(r: BookletRequest) => openWithDraft(r.requested_by, bookletReadyDraft(r.halaqa?.teacher?.full_name, r.booklet, r.copies, r.halaqa?.gender === 'female'))"
        />
        <template v-else>
          <UiEmptyState
            v-if="!deliveries.length"
            icon="i-lucide-package"
            title="لا تسليمات بعد"
            :description="isAdmin ? 'سجّل أوّل تسليم بزرّ «تسليم جديد».' : 'لم يُسجَّل تسليمٌ بعد.'"
          />
          <BookletsLog
            v-else
            :rows="deliveries"
            :halaqa-names="halaqaNames"
            :can-delete="isAdmin"
            @delete="(r) => deleteTarget = r"
          />
        </template>
      </template>
    </ClientOnly>

    <BookletsDeliveryModal
      v-model:open="modalOpen"
      :halaqat="halaqat"
      :busy="busy"
      @save="save"
    />

    <BookletsStockModal
      v-model:open="stockModal.open"
      :booklet="stockModal.booklet"
      :action="stockModal.action"
      :current="stockItem?.quantity ?? null"
      :alert-at="stockItem?.alertAt ?? null"
      :busy="stockBusy"
      @save="saveStock"
    />

    <BookletsMoveEditModal
      v-model:open="editOpen"
      :move="editMove"
      :busy="stockBusy"
      @save="saveMove"
    />

    <UiConfirmModal
      :open="!!deleteTarget"
      title="حذف التسليم"
      :message="`سيُحذف تسليم ${deleteTarget?.copies ?? ''} نسخة من السجلّ وينقص من المجموع، ويعود إلى المخزون.`"
      confirm-label="حذف"
      :loading="busy"
      @confirm="confirmDelete"
      @update:open="(v) => { if (!v) deleteTarget = null }"
    />
  </div>
</template>

<style scoped>
.stack { display: flex; flex-direction: column; gap: 14px; }
/* عرضُ السجلّ يملأ الشاشة بالضبط فلا تمريرَ للصفحة — الجدولُ وحده يُمرَّر وأرقامُ الصفحات ثابتةٌ في أسفله
   (طلب المستخدم 2026-10-28). الشريطُ العلويّ 76px وحشوةُ المحتوى أعلى وأسفل (والأسفلُ يزيد 60px). على الجوال
   تبقى الصفحةُ تُمرَّر: البطاقاتُ والأرقامُ أطولُ من أن تُحشر */
@media (min-width: 761px) {
  .booklets.fit { display: flex; flex-direction: column; height: calc(100dvh - 76px - 2 * var(--content-pad, 24px) - 60px); min-height: 480px; }
  .booklets.fit > * { flex: none; }
  .booklets.fit :deep(.log) { flex: 1; min-height: 0; }
  /* الأرقامُ مضغوطةٌ في صفٍّ واحد لكلّ بطاقة فيتّسع الجدول */
  .booklets.fit :deep(.stat.stacked) { flex-direction: row; align-items: center; gap: 14px; padding: 14px 18px; }
  .booklets.fit :deep(.stat.stacked .ico) { margin-bottom: 0; width: 42px; height: 42px; }
  .booklets.fit :deep(.stat.stacked .num) { font-size: 26px; }
  .booklets.fit :deep(.stat.stacked .lbl) { margin-top: 4px; font-size: 14px; }
}
.views { margin-bottom: 16px; }
/* خمسةُ تبويباتٍ لا تتّسع لعرض الجوال: تُمرَّر أفقياً بدل أن تنضغط */
@media (max-width: 760px) {
  .views { overflow-x: auto; scrollbar-width: none; }
  .views :deep(.tab) { flex: none; padding: 0 12px; }
}
</style>
