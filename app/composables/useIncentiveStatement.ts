import type { Ref } from 'vue'
import type { Database } from '~/types/database.types'
import { MIN_ITEM_DESCRIPTION_LENGTH, STATEMENT_ITEM_CATEGORIES } from '~/constants/incentives'

/**
 * كشفُ حوافز الحلقة لشهرٍ واحد (المعلّم): المبلغ المخصّص للقراءة، وبنودُ المصروف تُوثَّق
 * كلٌّ منها بتاريخٍ داخل شهر الكشف وبيانٍ واضح ومبلغٍ موجب. يُحمَّل تلقائياً عند تغيّر الشهر
 * (كان الكشفُ القديم يبقى على الشاشة تحت شهرٍ آخر)، والإرسالُ يحفظ أولاً فلا تضيع تعديلاتٌ لم تُحفظ.
 * الحفظُ يُدرج البنود ثم يحذف القديمة، فإن رفضت القاعدةُ بنداً بقي الكشفُ كما كان.
 */
type StatementStatus = Database['public']['Enums']['statement_status']
export interface StatementItemDraft { description: string, category: string, amount: number | string, item_date: string }
export type StatementItemField = 'description' | 'amount' | 'item_date'
export type StatementItemErrors = Partial<Record<StatementItemField, string>>
export interface DateBounds { min: string, max: string }

const iso = (y: number, m: number, d: number) => `${y}-${String(m).padStart(2, '0')}-${String(d).padStart(2, '0')}`

/** مدى تاريخ البند: من أوّل شهر الكشف إلى آخره، ولا يتجاوز اليوم. */
export function statementDateBounds(year: number, month: number, today: string): DateBounds {
  const last = iso(year, month, new Date(Date.UTC(year, month, 0)).getUTCDate())
  return { min: iso(year, month, 1), max: today < last ? today : last }
}

const amountOf = (v: number | string) => (v === '' || v === null ? 0 : Number(v))

/** سطرٌ لم يُكتب فيه بيانٌ ولا مبلغ — يُهمَل عند الحفظ بلا خطأ. */
export function isBlankItem(item: StatementItemDraft): boolean {
  return !item.description.trim() && !amountOf(item.amount)
}

/** أخطاءُ البند بالعربية؛ كائنٌ فارغ = صالح. */
export function validateStatementItem(item: StatementItemDraft, bounds: DateBounds): StatementItemErrors {
  const errors: StatementItemErrors = {}
  if (item.description.trim().length < MIN_ITEM_DESCRIPTION_LENGTH) errors.description = 'اكتب بياناً يوضّح المصروف.'
  const amount = amountOf(item.amount)
  if (!Number.isFinite(amount) || amount <= 0) errors.amount = 'المبلغ أكبر من صفر.'
  if (!item.item_date) errors.item_date = 'اختر تاريخ المصروف.'
  else if (item.item_date < bounds.min || item.item_date > bounds.max) errors.item_date = bounds.max < bounds.min ? 'الشهر لم يبدأ بعد.' : 'التاريخ داخل شهر الكشف ولا يتجاوز اليوم.'
  return errors
}

export function useIncentiveStatement(halaqaId: Ref<string | null>, month: Ref<number>, year: Ref<number>) {
  const supabase = useSupabaseClient<Database>()
  const { profile } = useProfile()
  const { handle } = useErrorHandler()
  // نيابةُ القراءة تُرفض قبل الإرسال: تحديثٌ لا يطابق صفّاً يعود «0 صفوف» بلا رفضٍ صريح
  const { blockIfReadOnly } = useImpersonation()
  const toast = useToast()

  const loading = ref(false)
  const loaded = ref(false)
  const saving = ref(false)
  const submitting = ref(false)
  const showErrors = ref(false)
  /** `returnNote`: ملاحظةُ المراجِع إن أعاد الكشف (تبقى بعد إعادة الإرسال سجلّاً). */
  const statement = ref<{ id: string, status: StatementStatus, returnNote: string | null } | null>(null)
  const allocated = ref(0)
  const rows = ref<StatementItemDraft[]>([])
  let savedIds: string[] = []

  const bounds = computed(() => statementDateBounds(year.value, month.value, gazaToday()))
  const canEdit = computed(() => !statement.value || statement.value.status === 'draft')
  const spent = computed(() => rows.value.reduce((s, r) => s + (amountOf(r.amount) || 0), 0))
  const remaining = computed(() => allocated.value - spent.value)
  const errors = computed(() => rows.value.map(r => (isBlankItem(r) ? {} : validateStatementItem(r, bounds.value))))
  const hasErrors = computed(() => errors.value.some(e => Object.keys(e).length > 0))

  async function load() {
    loaded.value = false
    showErrors.value = false
    if (!halaqaId.value) return
    loading.value = true
    try {
      const hid = halaqaId.value
      const [{ data: alloc, error: e1 }, { data: st, error: e2 }] = await Promise.all([
        supabase.from('halaqa_incentives').select('allocated_amount').eq('halaqa_id', hid).eq('incentive_month', month.value).eq('incentive_year', year.value).maybeSingle(),
        supabase.from('incentive_statements').select('id, status, return_note').eq('halaqa_id', hid).eq('statement_month', month.value).eq('statement_year', year.value).maybeSingle()
      ])
      if (e1 || e2) throw e1 ?? e2
      allocated.value = alloc?.allocated_amount ?? 0
      statement.value = st ? { id: st.id, status: st.status, returnNote: st.return_note } : null
      let items: { id: string, description: string | null, category: string | null, amount: number, item_date: string | null }[] = []
      if (st) {
        const { data, error } = await supabase.from('incentive_statement_items').select('id, description, category, amount, item_date').eq('statement_id', st.id).order('item_date')
        if (error) throw error
        items = data ?? []
      }
      savedIds = items.map(i => i.id)
      rows.value = items.map(i => ({ description: i.description ?? '', category: i.category ?? STATEMENT_ITEM_CATEGORIES[0], amount: i.amount, item_date: i.item_date ?? '' }))
      loaded.value = true
    } catch (err) {
      handle(err)
    } finally {
      loading.value = false
    }
  }

  watch([halaqaId, month, year], load, { immediate: true })

  function addRow() {
    const today = gazaToday()
    const inMonth = today >= bounds.value.min && today <= bounds.value.max
    rows.value.push({ description: '', category: STATEMENT_ITEM_CATEGORIES[0], amount: '', item_date: inMonth ? today : '' })
  }
  function removeRow(i: number) {
    rows.value.splice(i, 1)
  }

  /** يحفظ الكشف وبنوده؛ يُرجع `false` إن بقيت أخطاءٌ أو رفضت القاعدة. */
  async function save(): Promise<boolean> {
    if (!halaqaId.value) return false
    if (hasErrors.value) {
      showErrors.value = true
      toast.add({ title: 'أكمل البنود المعلَّمة قبل الحفظ.', color: 'warning', icon: 'i-lucide-info' })
      return false
    }
    saving.value = true
    try {
      blockIfReadOnly()
      let sid = statement.value?.id
      if (!sid) {
        const { data, error } = await supabase.from('incentive_statements')
          .insert({ halaqa_id: halaqaId.value, statement_month: month.value, statement_year: year.value, received_amount: allocated.value, status: 'draft', created_by: profile.value?.id ?? null })
          .select('id, status').single()
        if (error || !data) throw error
        statement.value = { id: data.id, status: data.status, returnNote: null }
        sid = data.id
      } else {
        const { error } = await supabase.from('incentive_statements').update({ received_amount: allocated.value }).eq('id', sid)
        if (error) throw error
      }
      const payload = rows.value.filter(r => !isBlankItem(r))
        .map(r => ({ statement_id: sid!, description: r.description.trim(), category: r.category, amount: amountOf(r.amount), item_date: r.item_date }))
      let insertedIds: string[] = []
      if (payload.length) {
        const { data, error } = await supabase.from('incentive_statement_items').insert(payload).select('id')
        if (error) throw error
        insertedIds = (data ?? []).map(d => d.id)
      }
      if (savedIds.length) {
        const { error } = await supabase.from('incentive_statement_items').delete().in('id', savedIds)
        if (error) throw error
      }
      savedIds = insertedIds
      rows.value = rows.value.filter(r => !isBlankItem(r))
      showErrors.value = false
      toast.add({ title: 'حُفظ الكشف.', color: 'success', icon: 'i-lucide-save' })
      return true
    } catch (err) {
      handle(err)
      return false
    } finally {
      saving.value = false
    }
  }

  async function submit() {
    submitting.value = true
    try {
      if (!(await save()) || !statement.value) return
      const { error } = await supabase.from('incentive_statements').update({ status: 'submitted', submitted_at: new Date().toISOString() }).eq('id', statement.value.id)
      if (error) throw error
      statement.value.status = 'submitted'
      toast.add({ title: 'أُرسل الكشف للمراجعة.', color: 'success', icon: 'i-lucide-send' })
    } catch (err) {
      handle(err)
    } finally {
      submitting.value = false
    }
  }

  return { loading, loaded, saving, submitting, showErrors, statement, allocated, rows, bounds, canEdit, spent, remaining, errors, hasErrors, addRow, removeRow, save, submit }
}
