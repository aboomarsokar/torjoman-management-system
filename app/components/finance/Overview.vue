<script setup lang="ts">
/** نظرة عامة مالية (§4.20أ) — بطاقات (رصيد/وارد/صادر) للشهر + توزّع المصروفات حسب التصنيف. */
import type { Database } from '~/types/database.types'

const supabase = useSupabaseClient<Database>()
const { handle } = useErrorHandler()

const now = new Date()
const yearItems = [now.getFullYear() - 1, now.getFullYear()].map(y => ({ label: String(y), value: y }))
const month = ref(now.getMonth() + 1)
const year = ref(now.getFullYear())

type Tx = { transaction_date: string, category: string | null, type: 'income' | 'expense', amount: number }
const allTx = ref<Tx[]>([])
const loading = ref(false)

async function load() {
  loading.value = true
  try {
    const { data } = await supabase.from('financial_transactions').select('transaction_date, category, type, amount').returns<Tx[]>()
    allTx.value = data ?? []
  } catch (err) {
    handle(err)
  } finally {
    loading.value = false
  }
}
onMounted(load)

const inMonth = (t: Tx) => {
  const d = new Date(t.transaction_date)
  return d.getMonth() + 1 === month.value && d.getFullYear() === year.value
}
const monthTx = computed(() => allTx.value.filter(inMonth))
const income = computed(() => monthTx.value.filter(t => t.type === 'income').reduce((s, t) => s + t.amount, 0))
const expense = computed(() => monthTx.value.filter(t => t.type === 'expense').reduce((s, t) => s + t.amount, 0))
// الرصيد الكلّي حتى نهاية الشهر المختار
const balance = computed(() => allTx.value
  .filter((t) => {
    const d = new Date(t.transaction_date)
    return d.getFullYear() < year.value || (d.getFullYear() === year.value && d.getMonth() + 1 <= month.value)
  })
  .reduce((s, t) => s + (t.type === 'income' ? t.amount : -t.amount), 0))

const byCategory = computed(() => {
  const map: Record<string, number> = {}
  for (const t of monthTx.value) {
    if (t.type === 'expense') map[t.category || 'أخرى'] = (map[t.category || 'أخرى'] ?? 0) + t.amount
  }
  const entries = Object.entries(map).sort((a, b) => b[1] - a[1])
  return entries.map(([cat, amt]) => ({ cat, amt, pct: expense.value ? Math.round(amt / expense.value * 100) : 0 }))
})

// ── الاتجاه مقارنةً بالشهر السابق ──
const prevM = computed(() => month.value === 1 ? 12 : month.value - 1)
const prevY = computed(() => month.value === 1 ? year.value - 1 : year.value)
function ym(iso: string) {
  const d = new Date(iso)
  return { m: d.getMonth() + 1, y: d.getFullYear() }
}
const sumMonth = (m: number, y: number, type: 'income' | 'expense') => allTx.value
  .filter(t => ym(t.transaction_date).m === m && ym(t.transaction_date).y === y && t.type === type)
  .reduce((s, t) => s + t.amount, 0)
const balanceUntil = (m: number, y: number) => allTx.value
  .filter((t) => {
    const d = ym(t.transaction_date)
    return d.y < y || (d.y === y && d.m <= m)
  })
  .reduce((s, t) => s + (t.type === 'income' ? t.amount : -t.amount), 0)

// pct = null حين يكون الشهر السابق صفراً: لا نسبة له (كانت تُعرض «100%» فتوهم بتغيّرٍ لا يُقاس)
type Delta = { dir: 'up' | 'down' | 'flat', pct: number | null }
const delta = (curr: number, prev: number): Delta => {
  if (prev === 0) return { dir: curr === 0 ? 'flat' : 'up', pct: null }
  const d = (curr - prev) / Math.abs(prev) * 100
  return { dir: d > 0.5 ? 'up' : d < -0.5 ? 'down' : 'flat', pct: Math.abs(Math.round(d)) }
}
const deltaText = (d: Delta) => (d.pct == null ? 'لا شهر سابق للمقارنة' : `${d.pct}% عن الشهر السابق`)
const incomeDelta = computed(() => delta(income.value, sumMonth(prevM.value, prevY.value, 'income')))
const expenseDelta = computed(() => delta(expense.value, sumMonth(prevM.value, prevY.value, 'expense')))
const balanceDelta = computed(() => delta(balance.value, balanceUntil(prevM.value, prevY.value)))

// ── منحنى الرصيد (آخر 6 أشهر) ──
const series = computed(() => {
  const arr: { label: string, value: number }[] = []
  for (let i = 5; i >= 0; i--) {
    let m = month.value - i
    let y = year.value
    while (m <= 0) {
      m += 12
      y -= 1
    }
    // الشهر برقمه — الاختصار («يون، يول») كان يصعب قراءته
    arr.push({ label: String(m), value: balanceUntil(m, y) })
  }
  return arr
})
const chart = computed(() => {
  const W = 320, H = 80, pad = 8
  const vals = series.value.map(s => s.value)
  const min = Math.min(...vals, 0)
  const max = Math.max(...vals, 0)
  const range = (max - min) || 1
  const n = series.value.length
  const pts = series.value.map((s, i) => ({
    x: pad + (n > 1 ? i * ((W - 2 * pad) / (n - 1)) : (W / 2)),
    y: H - pad - ((s.value - min) / range) * (H - 2 * pad),
    label: s.label
  }))
  return { W, H, pts, line: pts.map(p => `${p.x.toFixed(1)},${p.y.toFixed(1)}`).join(' ') }
})

const fmt = (n: number) => n.toLocaleString('ar')
const ARROW = { up: 'i-lucide-trending-up', down: 'i-lucide-trending-down', flat: 'i-lucide-minus' }
</script>

<template>
  <div>
    <div class="picker">
      <UiSelect
        v-model="month"
        :items="monthItems"
        size="md"
        class="sel"
      />
      <UiSelect
        v-model="year"
        :items="yearItems"
        size="md"
        class="sel"
      />
    </div>

    <ClientOnly>
      <div class="cards">
        <div class="card hero">
          <div class="c-lbl">
            الرصيد الحالي (حتى {{ monthName(month) }})
          </div>
          <div class="c-val">
            {{ fmt(balance) }} <span class="cur">₪</span>
          </div>
          <div
            class="trend"
            :class="`t-${balanceDelta.dir}`"
          >
            <UIcon
              :name="ARROW[balanceDelta.dir]"
              class="size-4"
            />
            {{ deltaText(balanceDelta) }}
          </div>
        </div>
        <div class="card">
          <div class="c-lbl">
            إجمالي الوارد للشهر
          </div>
          <div class="c-val in">
            +{{ fmt(income) }}
          </div>
          <div
            class="trend"
            :class="`t-${incomeDelta.dir}`"
          >
            <UIcon
              :name="ARROW[incomeDelta.dir]"
              class="size-4"
            />
            {{ deltaText(incomeDelta) }}
          </div>
        </div>
        <div class="card">
          <div class="c-lbl">
            إجمالي الصادر للشهر
          </div>
          <div class="c-val out">
            −{{ fmt(expense) }}
          </div>
          <div
            class="trend"
            :class="`t-${expenseDelta.dir}`"
          >
            <UIcon
              :name="ARROW[expenseDelta.dir]"
              class="size-4"
            />
            {{ deltaText(expenseDelta) }}
          </div>
        </div>
      </div>

      <div class="card curve">
        <h3>منحنى الرصيد (آخر 6 أشهر)</h3>
        <svg
          :viewBox="`0 0 ${chart.W} ${chart.H}`"
          class="svg"
          preserveAspectRatio="none"
        >
          <polyline
            :points="chart.line"
            fill="none"
            stroke="var(--blue)"
            stroke-width="2"
            stroke-linejoin="round"
            stroke-linecap="round"
          />
          <circle
            v-for="(p, i) in chart.pts"
            :key="i"
            :cx="p.x"
            :cy="p.y"
            r="2.5"
            fill="var(--blue)"
          />
        </svg>
        <div class="curve-labels">
          <span
            v-for="(p, i) in chart.pts"
            :key="i"
          >{{ p.label }}</span>
        </div>
      </div>

      <div class="card breakdown">
        <h3>توزّع المصروفات حسب التصنيف</h3>
        <UiEmptyState
          v-if="!byCategory.length"
          icon="i-lucide-pie-chart"
          title="لا مصروفات في هذا الشهر"
        />
        <div
          v-else
          class="bars"
        >
          <div
            v-for="b in byCategory"
            :key="b.cat"
            class="brow"
          >
            <div class="bhead">
              <span>{{ b.cat }}</span>
              <span class="bamt">{{ fmt(b.amt) }} · {{ b.pct }}%</span>
            </div>
            <div class="btrack">
              <div
                class="bfill"
                :style="{ width: b.pct + '%' }"
              />
            </div>
          </div>
        </div>
      </div>
    </ClientOnly>
  </div>
</template>

<style scoped>
.picker { display: flex; gap: 10px; margin-bottom: 16px; }
.sel { width: 140px; }
.cards { display: grid; grid-template-columns: 2fr 1fr 1fr; gap: 16px; margin-bottom: 18px; }
.card { background: var(--surface); border: 1px solid var(--line); border-radius: 18px; box-shadow: var(--shadow); padding: 22px; }
.hero { background: var(--navy); border-color: var(--navy); }
.hero .c-lbl, .hero .c-val { color: #fff; }
.c-lbl { font-size: 13.5px; color: var(--ink-3); }
.c-val { font-size: 30px; font-weight: 700; color: var(--ink); margin-top: 8px; font-variant-numeric: tabular-nums; }
.cur { font-size: 18px; opacity: .7; }
.c-val.in { color: var(--green-ink); }
.c-val.out { color: var(--err); }
.trend { display: inline-flex; align-items: center; gap: 5px; margin-top: 10px; font-size: 12.5px; font-weight: 600; }
.t-up { color: var(--green-ink); }
.t-down { color: var(--err); }
.t-flat { color: var(--ink-3); }
.hero .trend { color: rgba(255,255,255,.85); }

.curve { margin-bottom: 18px; }
.curve h3 { margin: 0 0 14px; font-size: 17px; font-weight: 700; color: var(--ink); }
.svg { width: 100%; height: 90px; display: block; }
.curve-labels { display: flex; justify-content: space-between; margin-top: 6px; padding: 0 6px; }
.curve-labels span { font-size: 11.5px; color: var(--ink-3); }

.breakdown h3 { margin: 0 0 16px; font-size: 17px; font-weight: 700; color: var(--ink); }
.bars { display: flex; flex-direction: column; gap: 14px; }
.bhead { display: flex; justify-content: space-between; font-size: 14px; color: var(--ink); margin-bottom: 6px; }
.bamt { color: var(--ink-3); font-size: 13px; }
.btrack { height: 10px; border-radius: 999px; background: var(--surface-3); overflow: hidden; }
.bfill { height: 100%; border-radius: 999px; background: var(--blue); }

@media (max-width: 760px) { .cards { grid-template-columns: 1fr; } }
</style>
