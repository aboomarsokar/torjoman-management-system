-- نتيجةُ المرشّح تُحسب تلقائياً (طلب المستخدم 2026-10-31): المديرُ الإداريّ وحده يقيّم بالعلامات (واللجنةُ على الورق
-- يشاورها في كلّ بند)، ومع كلّ حفظٍ لتقييمه تُعاد النتيجة من المتوسّط الموزون (من 100): مقبول ≥ 80 · تأهيل 75–79.9
-- (القيمةُ المخزّنة `reserve`) · مرفوض < 75. والقرارُ اليدويُّ من المدير يثبت (`decision_manual`) ولا يغيّره الحساب.

alter table public.candidates add column decision_manual boolean not null default false;

-- الأوزانُ بترتيب `CANDIDATE_CRITERIA` في الواجهة، وكلُّ بندٍ من 10
create or replace function private.candidate_weighted(p_scores smallint[])
returns numeric
language sql immutable
set search_path = ''
as $$
  select coalesce(sum(coalesce(s, 0)::numeric / 10 * w), 0)
    from unnest(p_scores, array[10, 10, 7.5, 7.5, 25, 15, 7.5, 7.5, 5, 5]::numeric[]) as t(s, w)
$$;
revoke all on function private.candidate_weighted(smallint[]) from public, anon, authenticated;

-- العتباتُ — تطابق `CANDIDATE_PASS_MARK` و`CANDIDATE_QUALIFY_MARK` في الواجهة
create or replace function private.candidate_auto_status(p_avg numeric)
returns public.candidate_status
language sql immutable
set search_path = ''
as $$
  select case when p_avg is null then null
              when p_avg >= 80 then 'accepted'::public.candidate_status
              when p_avg >= 75 then 'reserve'::public.candidate_status
              else 'rejected'::public.candidate_status end
$$;
revoke all on function private.candidate_auto_status(numeric) from public, anon, authenticated;

-- إعادةُ النتيجة لمرشّحٍ من تقييماته — ما لم يكن قرارُه يدوياً أو عُيّن معلّماً أو لم يُدعَ بعد
create or replace function private.candidate_recompute(p_candidate uuid)
returns void
language plpgsql security definer
set search_path = ''
as $$
declare
  v_avg numeric;
  v_status public.candidate_status;
begin
  select round(avg(private.candidate_weighted(scores)), 1) into v_avg
    from public.candidate_evaluations where candidate_id = p_candidate;
  v_status := coalesce(private.candidate_auto_status(v_avg), 'interviewed');
  -- علَمٌ للمعاملة: `candidate_touch` يعرف أنّ التغيير آليٌّ فلا يحرسه ولا يُثبّته يدوياً
  perform set_config('torjoman.auto_decision', 'on', true);
  update public.candidates set status = v_status
   where id = p_candidate and not decision_manual
     and status in ('invited', 'interviewed', 'accepted', 'reserve', 'rejected')
     and status is distinct from v_status;
  perform set_config('torjoman.auto_decision', 'off', true);
end;
$$;
revoke all on function private.candidate_recompute(uuid) from public, anon, authenticated;

create or replace function private.candidate_evaluation_touch()
returns trigger
language plpgsql security definer
set search_path = ''
as $$
begin
  new.updated_at := now();
  return new;
end;
$$;

create or replace function private.candidate_evaluation_recompute()
returns trigger
language plpgsql security definer
set search_path = ''
as $$
begin
  perform private.candidate_recompute(coalesce(new.candidate_id, old.candidate_id));
  return null;
end;
$$;
revoke all on function private.candidate_evaluation_recompute() from public, anon, authenticated;
create trigger candidate_evaluations_recompute after insert or update or delete on public.candidate_evaluations
  for each row execute function private.candidate_evaluation_recompute();

-- القرارُ للمدير الإداريّ وحده كما كان، والحسابُ الآليّ (`candidate_recompute`) يمرّ؛ والقرارُ المباشرُ من المدير يثبت يدوياً،
-- والرجوعُ إلى ما قبل القرار (دعوةٌ جديدة) يُعيد الحسابَ آلياً
create or replace function private.candidate_touch()
returns trigger
language plpgsql security definer
set search_path = ''
as $$
declare
  v_decisions text[] := array['accepted', 'reserve', 'rejected'];
  v_auto boolean := coalesce(current_setting('torjoman.auto_decision', true), 'off') = 'on';
begin
  new.updated_at := now();
  if tg_op = 'UPDATE' then
    if not v_auto and (select auth.uid()) is not null and not public.is_admin_manager() and (
         (new.status is distinct from old.status and (new.status::text = any (v_decisions) or old.status::text = any (v_decisions)))
         or new.decision_note is distinct from old.decision_note) then
      raise exception 'قرارُ المرشّح للمدير الإداري وحده' using errcode = '42501';
    end if;
    if new.status is distinct from old.status then
      new.status_changed_by := auth.uid();
      new.status_changed_at := now();
      new.result_sms_at := null;
      if new.status::text = any (v_decisions) then
        new.decision_manual := not v_auto;
      elsif new.status in ('new', 'invited') then
        new.decision_manual := false;
      end if;
    end if;
  end if;
  return new;
end;
$$;

-- التقييمُ بالعلامات للمدير الإداريّ وحده (ويُحذف بيده)؛ والقراءةُ كما هي
drop policy candidate_evaluations_insert on public.candidate_evaluations;
drop policy candidate_evaluations_update on public.candidate_evaluations;
drop policy candidate_evaluations_delete on public.candidate_evaluations;
create policy candidate_evaluations_insert on public.candidate_evaluations for insert to authenticated
  with check (evaluator_id = (select auth.uid()) and (select public.is_admin_manager()));
create policy candidate_evaluations_update on public.candidate_evaluations for update to authenticated
  using (evaluator_id = (select auth.uid()) and (select public.is_admin_manager()))
  with check (evaluator_id = (select auth.uid()) and (select public.is_admin_manager()));
create policy candidate_evaluations_delete on public.candidate_evaluations for delete to authenticated
  using ((select public.is_admin_manager()));

-- «تأهيل» بدل «احتياط» في صيغة رسالة النتيجة (والمحفوظةُ تُستبدل إن كانت الأصليةَ القديمة)
alter table public.app_settings alter column candidate_result_sms_reserve
  set default '{الأخ/الأخت} {الاسم}، نتيجتك في مقابلة الالتحاق بمعلّمي منصة ترجمان القرآنية تؤهّلك للالتحاق ببرنامج التأهيل، وسنتواصل معك بموعده.';
update public.app_settings
   set candidate_result_sms_reserve = '{الأخ/الأخت} {الاسم}، نتيجتك في مقابلة الالتحاق بمعلّمي منصة ترجمان القرآنية تؤهّلك للالتحاق ببرنامج التأهيل، وسنتواصل معك بموعده.'
 where candidate_result_sms_reserve = '{الأخ/الأخت} {الاسم}، شكراً لحضورك مقابلة الالتحاق بمعلّمي منصة ترجمان القرآنية. أُدرج اسمك في قائمة الاحتياط، وسنتواصل معك عند توفّر حلقة.';

-- حسابُ القائم: كلُّ مرشّحٍ مُقيَّمٍ قرارُه غيرُ يدويّ
select private.candidate_recompute(id) from public.candidates
 where exists (select 1 from public.candidate_evaluations e where e.candidate_id = candidates.id);
