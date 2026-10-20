-- أداءٌ قبل الإطلاق (مستشار أداء Supabase):
-- (١) خمسَ عشرةَ سياسةً تستدعي auth.uid() لكلّ صفّ (auth_rls_initplan) — تُلفّ في (select auth.uid()) فتُحسب
--     مرّةً للطلب. المعنى واحد؛ والتعبيرُ يُعاد بناؤه من تعريفه الحيّ بالاستبدال فلا يُكتب يدوياً فيخطئ.
-- (٢) فهارسُ لثلاثة مفاتيح ربطٍ تُستعمل في الربط والحذف بالتتالي: بنودُ الكشف، وسجلُّ تغيير المواعيد، والغيابات.
--     (بقيّةُ المفاتيح بلا فهرس أعمدةُ تدقيقٍ — created_by وأمثالها — لا يُربط بها.)

do $$
declare
  p record;
  q text;
  w text;
  sql text;
begin
  for p in
    select c.relname tbl, pol.polname, pg_get_expr(pol.polqual, pol.polrelid) q, pg_get_expr(pol.polwithcheck, pol.polrelid) w
    from pg_policy pol join pg_class c on c.oid = pol.polrelid join pg_namespace n on n.oid = c.relnamespace
    where n.nspname = 'public'
      and (c.relname, pol.polname) in (
        ('admin_alerts','alerts_insert'), ('admin_alerts','alerts_select'), ('admin_alerts','alerts_update'),
        ('exam_lists','lists_delete'), ('exam_lists','lists_insert'),
        ('exam_results','results_insert'), ('exam_results','results_update'),
        ('profiles','profiles_select'), ('profiles','profiles_update'),
        ('students','students_select'), ('students','students_update'),
        ('supervision_visits','visits_delete'), ('supervision_visits','visits_insert'), ('supervision_visits','visits_update'),
        ('visit_reschedule_log','reschedule_insert'))
  loop
    q := regexp_replace(p.q, 'auth\.uid\(\)', '(select auth.uid())', 'g');
    w := regexp_replace(p.w, 'auth\.uid\(\)', '(select auth.uid())', 'g');
    sql := format('alter policy %I on public.%I', p.polname, p.tbl);
    if q is not null then sql := sql || format(' using (%s)', q); end if;
    if w is not null then sql := sql || format(' with check (%s)', w); end if;
    execute sql;
  end loop;
end
$$;

create index if not exists incentive_statement_items_statement_idx on public.incentive_statement_items (statement_id);
create index if not exists visit_reschedule_log_visit_idx on public.visit_reschedule_log (visit_id);
create index if not exists attendance_absences_halaqa_day_idx on public.attendance_absences (halaqa_id, day);
