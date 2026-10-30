-- صيغةُ رسالة دعوة المقابلة SMS المعتمدة (طلب المستخدم 2026-10-30): يعدّلها المدير الإداري (سياسة settings_write القائمة)،
-- ومتغيّراتُها تُستبدل لكلّ مرشّح: {الأخ/الأخت} {الاسم} {الموعد} {المكان}.
alter table public.app_settings add column candidate_invite_sms text not null
  default '{الأخ/الأخت} {الاسم}، يسرّنا دعوتك لمقابلة الالتحاق بمعلّمي منصة ترجمان القرآنية يوم {الموعد} في {المكان}.'
  check (char_length(btrim(candidate_invite_sms)) between 10 and 500);
