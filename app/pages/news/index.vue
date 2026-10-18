<script setup lang="ts">
/**
 * إدارة الأخبار (§4.26) — للمدير الإداري (ومشرف المشروع اطّلاعاً). تظهر المنشورة للزوّار على صفحة الهبوط.
 * إنشاء/تعديل/حذف + نشر/إخفاء + فتح للقراءة. رفع الصورة إلى Storage (اختياري).
 */
import type { Database } from '~/types/database.types'

definePageMeta({ layout: 'dashboard' })
useSeoMeta({ title: 'الأخبار — ترجمان' })

const supabase = useSupabaseClient<Database>()
const { profile } = useProfile()
const { handle } = useErrorHandler()
const { uploadImage } = useUpload()
const toast = useToast()
const { isAdmin, isReadOnly } = usePermissions()
const canView = computed(() => isAdmin.value || isReadOnly.value)

const uploading = ref(false)
async function onPickImage(e: Event) {
  const file = (e.target as HTMLInputElement).files?.[0]
  if (!file) return
  uploading.value = true
  try {
    form.image_url = await uploadImage(file, 'news')
    toast.add({ title: 'رُفعت الصورة.', color: 'success', icon: 'i-lucide-image' })
  } catch (err) {
    toast.add({ title: (err as Error).message || 'تعذّر رفع الصورة.', color: 'error', icon: 'i-lucide-circle-alert' })
  } finally {
    uploading.value = false
  }
}

const CATEGORIES = ['إعلان', 'إنجاز', 'فعالية', 'عام']
const categoryItems = CATEGORIES.map(c => ({ label: c, value: c }))

type NewsRow = {
  id: string
  title: string
  body: string | null
  category: string | null
  image_url: string | null
  news_date: string
  published: boolean
}

const { data: news, refresh, pending } = useLazyAsyncData<NewsRow[]>('news-admin', async () => {
  const { data } = await supabase
    .from('news')
    .select('id, title, body, category, image_url, news_date, published')
    .order('news_date', { ascending: false })
    .returns<NewsRow[]>()
  return data ?? []
}, { server: false, default: () => [] })

// ── إنشاء/تعديل ──
const today = new Date().toISOString().slice(0, 10)
const modalOpen = ref(false)
const editingId = ref<string | null>(null)
const saving = ref(false)
const form = reactive({ title: '', news_date: today, category: 'إعلان', body: '', image_url: '', published: true })

function openCreate() {
  editingId.value = null
  form.title = ''
  form.news_date = today
  form.category = 'إعلان'
  form.body = ''
  form.image_url = ''
  form.published = true
  modalOpen.value = true
}
function openEdit(n: NewsRow) {
  editingId.value = n.id
  form.title = n.title
  form.news_date = n.news_date
  form.category = n.category ?? 'إعلان'
  form.body = n.body ?? ''
  form.image_url = n.image_url ?? ''
  form.published = n.published
  modalOpen.value = true
}

async function save() {
  if (!form.title.trim()) {
    toast.add({ title: 'اكتب عنوان الخبر.', color: 'error', icon: 'i-lucide-circle-alert' })
    return
  }
  saving.value = true
  try {
    const payload = {
      title: form.title.trim(),
      news_date: form.news_date,
      category: form.category,
      body: form.body.trim() || null,
      image_url: form.image_url.trim() || null,
      published: form.published
    }
    if (editingId.value) {
      const { error } = await supabase.from('news').update(payload).eq('id', editingId.value)
      if (error) throw error
    } else {
      const { error } = await supabase.from('news').insert({ ...payload, created_by: profile.value?.id ?? null })
      if (error) throw error
    }
    toast.add({ title: editingId.value ? 'حُدّث الخبر.' : 'نُشر الخبر.', color: 'success', icon: 'i-lucide-circle-check' })
    modalOpen.value = false
    await refresh()
  } catch (err) {
    handle(err)
  } finally {
    saving.value = false
  }
}

async function togglePublish(n: NewsRow) {
  try {
    const { error } = await supabase.from('news').update({ published: !n.published }).eq('id', n.id)
    if (error) throw error
    n.published = !n.published
    toast.add({ title: n.published ? 'أصبح الخبر منشوراً.' : 'أُخفي الخبر.', color: 'success', icon: 'i-lucide-eye' })
  } catch (err) {
    handle(err)
  }
}

// ── حذف ──
const deleteTarget = ref<NewsRow | null>(null)
const deleting = ref(false)
async function confirmDelete() {
  if (!deleteTarget.value) return
  deleting.value = true
  try {
    const { error } = await supabase.from('news').delete().eq('id', deleteTarget.value.id)
    if (error) throw error
    toast.add({ title: 'حُذف الخبر.', color: 'success', icon: 'i-lucide-trash-2' })
    deleteTarget.value = null
    await refresh()
  } catch (err) {
    handle(err)
  } finally {
    deleting.value = false
  }
}

// ── قراءة ──
const reading = ref<NewsRow | null>(null)

const fmtDate = (iso: string) => new Date(iso).toLocaleDateString('ar', { day: 'numeric', month: 'long', year: 'numeric' })
</script>

<template>
  <div class="news-admin">
    <UiPageHeader
      title="الأخبار"
      subtitle="أخبار وإعلانات تظهر للزوّار على صفحة الهبوط — أنشئ وانشر وتابع."
    >
      <template
        v-if="isAdmin"
        #actions
      >
        <UButton
          label="خبر جديد"
          color="primary"
          size="lg"
          icon="i-lucide-plus"
          :ui="{ base: 'rounded-[13px] font-semibold' }"
          @click="openCreate"
        />
      </template>
    </UiPageHeader>

    <UiEmptyState
      v-if="!canView"
      icon="i-lucide-lock"
      title="هذه الصفحة للمدير الإداري فقط."
    />

    <ClientOnly v-else>
      <div
        v-if="pending"
        class="grid"
      >
        <UiSkeletonCard
          v-for="i in 6"
          :key="i"
          image
        />
      </div>
      <UiEmptyState
        v-else-if="!news || !news.length"
        icon="i-lucide-newspaper"
        title="لا أخبار بعد"
        description="أنشئ أول خبر ليظهر للزوّار."
      />

      <div
        v-else
        class="grid"
      >
        <article
          v-for="n in news"
          :key="n.id"
          class="card ncard"
          :class="{ unpub: !n.published }"
        >
          <div class="nimg">
            <img
              v-if="n.image_url"
              :src="n.image_url"
              :alt="n.title"
            >
            <UIcon
              v-else
              name="i-lucide-newspaper"
              class="size-9 opacity-40"
            />
            <UBadge
              v-if="!n.published"
              label="مخفيّ"
              color="neutral"
              variant="solid"
              size="sm"
              class="pub-flag"
            />
          </div>
          <div class="nbody">
            <div class="nmeta">
              <UBadge
                :label="n.category || 'عام'"
                color="info"
                variant="soft"
                size="sm"
              />
              <span class="ndate">{{ fmtDate(n.news_date) }}</span>
            </div>
            <h3 class="ntitle">
              {{ n.title }}
            </h3>
            <p
              v-if="n.body"
              class="nexcerpt"
            >
              {{ n.body }}
            </p>
            <div class="nactions">
              <UButton
                label="قراءة"
                color="neutral"
                variant="ghost"
                size="sm"
                icon="i-lucide-book-open"
                :ui="{ base: 'rounded-[10px]' }"
                @click="reading = n"
              />
              <UButton
                v-if="isAdmin"
                :label="n.published ? 'إخفاء' : 'نشر'"
                :color="n.published ? 'neutral' : 'primary'"
                variant="ghost"
                size="sm"
                :icon="n.published ? 'i-lucide-eye-off' : 'i-lucide-eye'"
                :ui="{ base: 'rounded-[10px]' }"
                @click="togglePublish(n)"
              />
              <UButton
                v-if="isAdmin"
                color="neutral"
                variant="ghost"
                size="sm"
                icon="i-lucide-pencil"
                aria-label="تعديل"
                :ui="{ base: 'rounded-[10px]' }"
                @click="openEdit(n)"
              />
              <UButton
                v-if="isAdmin"
                color="error"
                variant="ghost"
                size="sm"
                icon="i-lucide-trash-2"
                aria-label="حذف"
                :ui="{ base: 'rounded-[10px]' }"
                @click="deleteTarget = n"
              />
            </div>
          </div>
        </article>
      </div>
    </ClientOnly>

    <!-- نافذة إنشاء/تعديل -->
    <UModal
      v-model:open="modalOpen"
      :title="editingId ? 'تعديل الخبر' : 'خبر جديد'"
    >
      <template #body>
        <div class="form">
          <UFormField
            label="العنوان"
            required
          >
            <UInput
              v-model="form.title"
              size="lg"
              class="w-full"
              :ui="{ base: 'rounded-[13px]' }"
            />
          </UFormField>
          <div class="row">
            <UFormField
              label="التصنيف"
              class="f1"
            >
              <UiSelect
                v-model="form.category"
                :items="categoryItems"
                size="lg"
              />
            </UFormField>
            <UFormField
              label="التاريخ"
              class="f1"
            >
              <UInput
                v-model="form.news_date"
                type="date"
                size="lg"
                class="w-full"
                :ui="{ base: 'rounded-[13px]' }"
              />
            </UFormField>
          </div>
          <UFormField label="النص">
            <UTextarea
              v-model="form.body"
              :rows="4"
              size="lg"
              class="w-full"
              :ui="{ base: 'rounded-[13px]' }"
            />
          </UFormField>
          <UFormField label="الصورة (اختياري)">
            <div class="uploader">
              <div class="up-preview">
                <img
                  v-if="form.image_url"
                  :src="form.image_url"
                  alt=""
                >
                <UIcon
                  v-else
                  name="i-lucide-image"
                  class="size-7 opacity-40"
                />
              </div>
              <div class="up-actions">
                <label class="up-btn">
                  <UIcon
                    :name="uploading ? 'i-lucide-loader-circle' : 'i-lucide-upload'"
                    :class="['size-4', uploading && 'spin']"
                  />
                  {{ uploading ? 'يجري الرفع…' : 'رفع صورة' }}
                  <input
                    type="file"
                    accept="image/*"
                    hidden
                    :disabled="uploading"
                    @change="onPickImage"
                  >
                </label>
                <UButton
                  v-if="form.image_url"
                  label="إزالة"
                  color="error"
                  variant="ghost"
                  size="sm"
                  icon="i-lucide-x"
                  @click="form.image_url = ''"
                />
              </div>
            </div>
          </UFormField>
          <USwitch
            v-model="form.published"
            label="منشور (يظهر للزوّار)"
          />
        </div>
      </template>
      <template #footer>
        <div class="modal-foot">
          <UButton
            label="إلغاء"
            color="neutral"
            variant="ghost"
            @click="modalOpen = false"
          />
          <UButton
            :label="editingId ? 'حفظ' : 'نشر'"
            color="primary"
            icon="i-lucide-check"
            :loading="saving"
            :ui="{ base: 'rounded-[13px] font-semibold' }"
            @click="save"
          />
        </div>
      </template>
    </UModal>

    <!-- نافذة القراءة -->
    <UModal
      :open="!!reading"
      :title="reading?.title"
      @update:open="(v) => { if (!v) reading = null }"
    >
      <template #body>
        <div
          v-if="reading"
          class="reader"
        >
          <img
            v-if="reading.image_url"
            :src="reading.image_url"
            :alt="reading.title"
            class="reader-img"
          >
          <div class="nmeta">
            <UBadge
              :label="reading.category || 'عام'"
              color="info"
              variant="soft"
              size="sm"
            />
            <span class="ndate">{{ fmtDate(reading.news_date) }}</span>
          </div>
          <p class="reader-body">
            {{ reading.body || 'لا نصّ.' }}
          </p>
        </div>
      </template>
    </UModal>

    <!-- تأكيد الحذف -->
    <UiConfirmModal
      :open="!!deleteTarget"
      title="حذف الخبر"
      :message="`سيُحذف «${deleteTarget?.title}» نهائيّاً.`"
      confirm-label="حذف"
      :loading="deleting"
      @confirm="confirmDelete"
      @update:open="(v) => { if (!v) deleteTarget = null }"
    />
  </div>
</template>

<style scoped>
.card { background: var(--surface); border: 1px solid var(--line); border-radius: 18px; box-shadow: var(--shadow); }

.grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(300px, 1fr)); gap: 18px; }
.ncard { overflow: hidden; display: flex; flex-direction: column; transition: opacity .2s; }
.ncard.unpub { opacity: .62; }
.nimg { position: relative; height: 150px; background: var(--surface-2); display: flex; align-items: center; justify-content: center; }
.nimg img { width: 100%; height: 100%; object-fit: cover; }
.pub-flag { position: absolute; top: 10px; inset-inline-end: 10px; }
.nbody { padding: 16px 18px; display: flex; flex-direction: column; flex: 1; }
.nmeta { display: flex; align-items: center; gap: 10px; margin-bottom: 9px; }
.ndate { font-size: 12.5px; color: var(--ink-3); }
.ntitle { margin: 0; font-size: 16.5px; font-weight: 700; color: var(--ink); line-height: 1.5; }
.nexcerpt { margin: 8px 0 0; font-size: 13.5px; color: var(--ink-2); line-height: 1.7; display: -webkit-box; -webkit-line-clamp: 2; line-clamp: 2; -webkit-box-orient: vertical; overflow: hidden; }
.nactions { display: flex; gap: 2px; margin-top: 14px; padding-top: 12px; border-top: 1px solid var(--line); flex-wrap: wrap; }

.form { display: flex; flex-direction: column; gap: 16px; }
.uploader { display: flex; align-items: center; gap: 14px; }
.up-preview { width: 86px; height: 64px; border-radius: 12px; background: var(--surface-2); border: 1px solid var(--line); display: flex; align-items: center; justify-content: center; overflow: hidden; flex: none; }
.up-preview img { width: 100%; height: 100%; object-fit: cover; }
.up-actions { display: flex; align-items: center; gap: 8px; flex-wrap: wrap; }
.up-btn { display: inline-flex; align-items: center; gap: 8px; padding: 9px 16px; border-radius: 12px; border: 1px solid var(--line-2); background: var(--surface-2); color: var(--ink); font-size: 14px; font-weight: 600; cursor: pointer; }
.up-btn:hover { border-color: var(--blue); }
.spin { animation: spin 1s linear infinite; }
@keyframes spin { to { transform: rotate(360deg); } }
.row { display: flex; gap: 14px; }
.f1 { flex: 1; }
.modal-foot { display: flex; justify-content: flex-end; gap: 10px; }

.reader-img { width: 100%; max-height: 260px; object-fit: cover; border-radius: 13px; margin-bottom: 14px; }
.reader-body { margin: 12px 0 0; font-size: 15px; color: var(--ink); line-height: 1.9; white-space: pre-wrap; }

@media (max-width: 560px) { .row { flex-direction: column; } }
</style>
