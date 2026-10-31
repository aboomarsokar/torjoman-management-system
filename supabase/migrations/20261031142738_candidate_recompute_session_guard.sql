-- حارسُ الجلسة في `private.candidate_recompute` (قاعدةُ المشروع: كلُّ دالّة security definer كاتبةٍ تبدأ به). يُستدعى من
-- مشغّل التقييم بعد إدراجٍ يحرسه حارسُ الجدول أصلاً، فلا يغيّر سلوكاً — لكنّه يُبقي الدالّة آمنةً إن استُدعيت من غيره.

create or replace function private.candidate_recompute(p_candidate uuid)
returns void
language plpgsql security definer
set search_path = ''
as $$
declare
  v_avg numeric;
  v_status public.candidate_status;
begin
  perform private.assert_session_writable();
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
