-- رسالةُ النتيجة SMS للمرشّحين، وقرارُ المرشّح للمدير الإداريّ وحده (طلب المستخدم 2026-10-31).
-- ثلاثُ صيغٍ معتمدةٍ قابلةٍ للتعديل (مقبول · احتياط · مرفوض) بالمتغيّرين {الأخ/الأخت} و{الاسم}، و`result_sms_at`
-- يُختم لمن وصلته ويُصفَّر حين تتغيّر حالتُه. وحارسٌ في `candidate_touch`: لا يضع القرارَ أو يغيّره أو يمسّ ملاحظتَه
-- إلا المديرُ الإداريّ (والخادمُ بلا جلسة).

alter table public.app_settings
  add column candidate_result_sms_accepted text not null
    default '{الأخ/الأخت} {الاسم}، يسرّنا إبلاغك بقبولك ضمن معلّمي منصة ترجمان القرآنية، وسنتواصل معك قريباً لترتيب البدء.'
    check (char_length(candidate_result_sms_accepted) between 10 and 500),
  add column candidate_result_sms_reserve text not null
    default '{الأخ/الأخت} {الاسم}، شكراً لحضورك مقابلة الالتحاق بمعلّمي منصة ترجمان القرآنية. أُدرج اسمك في قائمة الاحتياط، وسنتواصل معك عند توفّر حلقة.'
    check (char_length(candidate_result_sms_reserve) between 10 and 500),
  add column candidate_result_sms_rejected text not null
    default '{الأخ/الأخت} {الاسم}، شكراً لاهتمامك بالالتحاق بمعلّمي منصة ترجمان القرآنية. نعتذر عن عدم قبول طلبك في هذه المرحلة، ونسأل الله لك التوفيق.'
    check (char_length(candidate_result_sms_rejected) between 10 and 500);

alter table public.candidates add column result_sms_at timestamptz;

create or replace function private.candidate_touch()
returns trigger
language plpgsql security definer
set search_path = ''
as $$
declare
  v_decisions text[] := array['accepted', 'reserve', 'rejected'];
begin
  new.updated_at := now();
  if tg_op = 'UPDATE' then
    -- القرارُ (وضعُه أو تغييرُه أو الرجوعُ عنه) وملاحظتُه للمدير الإداريّ وحده؛ والخادمُ بلا جلسة يمرّ
    if (select auth.uid()) is not null and not public.is_admin_manager() and (
         (new.status is distinct from old.status and (new.status::text = any (v_decisions) or old.status::text = any (v_decisions)))
         or new.decision_note is distinct from old.decision_note) then
      raise exception 'قرارُ المرشّح للمدير الإداري وحده' using errcode = '42501';
    end if;
    if new.status is distinct from old.status then
      new.status_changed_by := auth.uid();
      new.status_changed_at := now();
      new.result_sms_at := null;
    end if;
  end if;
  return new;
end;
$$;
