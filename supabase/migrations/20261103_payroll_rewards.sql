-- كشفُ الرواتب بالتقييم (طلب المستخدم 2026-11-03):
-- · المكافأةُ الأساسية لكلّ عامل `profile_financials.base_reward` (فارغةٌ = الافتراضيّة `app_settings.default_reward` = 600).
-- · المعلم: المستحقّ = المكافأة × التقييمُ النهائيّ ÷ 100 مرفوعاً إلى أقرب 5 (لا يُنقص)؛ والمشرفُ والمختبِرُ وغيرُهما المكافأةُ كاملة.
-- · لقطةُ الحساب في `monthly_salaries` (المكافأة · التقييم · التعديل اليدويّ وسببُه الإلزاميّ) — الحسابُ في الواجهة، والكتابةُ للمدير الإداري (RLS قائمة).
alter table public.app_settings add column default_reward numeric(10, 2) not null default 600
  constraint app_settings_default_reward_positive check (default_reward > 0);
alter table public.profile_financials add column base_reward numeric(10, 2)
  constraint profile_financials_base_reward_positive check (base_reward is null or base_reward > 0);
alter table public.monthly_salaries
  add column base_reward numeric(10, 2),
  add column final_score numeric(5, 2) constraint monthly_salaries_final_score_range check (final_score is null or final_score between 0 and 100),
  add column adjustment numeric(10, 2) not null default 0,
  add column adjustment_note text constraint monthly_salaries_adjustment_note_len check (adjustment_note is null or char_length(adjustment_note) <= 200),
  add constraint monthly_salaries_adjustment_needs_note check (adjustment = 0 or char_length(btrim(coalesce(adjustment_note, ''))) > 0);
