<script setup lang="ts">
/**
 * أرشيفُ الملازم (طلب المستخدم 2026-10-21) — ما استلمته كلُّ حلقةٍ من ملازم المشروع الخمسَ عشرة
 * (الجزء 29 + 30 … 1 + 2) بنُسخها وتواريخها، لإحصاء العدد. المديرُ الإداريّ يسجّل ويحذف، ومشرفُ المشروع
 * يقرأ (RLS على `booklet_deliveries`). ثلاثةُ عروض: حسب الحلقة · حسب الملزمة · السجلّ.
 */
import type { DeliveryDraft } from '~/composables/useBooklets'
import type { DeliveryRow } from '~/utils/booklets'
import { bookletStats, halaqaBooklets, totalsByBooklet } from '~/utils/booklets'

definePageMeta({ layout: 'dashboard' })
useSeoMeta({ title: 'أرشيف الملازم — ترجمان' })

type View = 'halaqa' | 'booklet' | 'log' | 'requests'

const { role, isAdmin, isReadOnly } = usePermissions()
const canView = computed(() => isAdmin.value || isReadOnly.value)
const { deliveries, halaqat, pending, busy, addDelivery, removeDelivery, refresh: refreshDeliveries } = useBooklets()
// طلباتُ المعلّمين (2026-10-25) — إشعارُ الطلب يفتح هذا العرض (?view=requests)، والعددُ للمفتوحة الجديدة
const { requests, openCount, busy: reqBusy, deliverRequest } = useBookletRequests()
/** «تمّ التسليم» يسجّل التسليمَ في الأرشيف — فتُحدَّث الأرقامُ والعروضُ معه. */
async function deliver(id: string, deliveredOn: string) {
  if (await deliverRequest(id, deliveredOn)) await refreshDeliveries()
}

const route = useRoute()
const view = ref<View>(route.query.view === 'requests' ? 'requests' : 'halaqa')
const viewOptions = computed(() => [
  { value: 'halaqa' as const, label: 'حسب الحلقة' },
  { value: 'booklet' as const, label: 'حسب الملزمة' },
  { value: 'log' as const, label: 'السجلّ', count: deliveries.value.length },
  { value: 'requests' as const, label: 'الطلبات', count: openCount.value || undefined }
])

const stats = computed(() => bookletStats(deliveries.value, halaqat.value.length))
const byHalaqa = computed(() => halaqaBooklets(deliveries.value, halaqat.value))
const byBooklet = computed(() => totalsByBooklet(deliveries.value))
const halaqaNames = computed(() => Object.fromEntries(halaqat.value.map(h => [h.id, h.name])))

const modalOpen = ref(false)
async function save(draft: DeliveryDraft, today: string) {
  if (await addDelivery(draft, today)) modalOpen.value = false
}

const deleteTarget = ref<DeliveryRow | null>(null)
async function confirmDelete() {
  if (deleteTarget.value && await removeDelivery(deleteTarget.value.id)) deleteTarget.value = null
}
</script>

<template>
  <div class="booklets">
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
        <UiFilterChips
          v-model="view"
          :options="viewOptions"
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
        <BookletsRequests
          v-else-if="view === 'requests'"
          :rows="requests ?? []"
          :can-close="isAdmin"
          :busy="reqBusy"
          @deliver="deliver"
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

    <UiConfirmModal
      :open="!!deleteTarget"
      title="حذف التسليم"
      :message="`سيُحذف تسليم ${deleteTarget?.copies ?? ''} نسخة من السجلّ وينقص من المجموع.`"
      confirm-label="حذف"
      :loading="busy"
      @confirm="confirmDelete"
      @update:open="(v) => { if (!v) deleteTarget = null }"
    />
  </div>
</template>

<style scoped>
.stack { display: flex; flex-direction: column; gap: 14px; }
.views { margin-bottom: 16px; }
</style>
