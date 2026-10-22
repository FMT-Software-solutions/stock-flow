-- Report and dashboard RPCs: only members of an organization may read it.
--
-- These functions are SECURITY DEFINER (they read past RLS) and trusted the
-- p_organization_id they were given, so any signed-in user could read another
-- organization's figures by passing its id. 20261026000000_reports_refresh.sql
-- added public.assert_org_member() and used it in the functions it rewrote;
-- this patches the rest in place instead of copying their bodies, so it also
-- covers the versions redefined by the discounts rebuild.
--
-- Scope: public functions named get_*_stats or get_*_report that are
-- SECURITY DEFINER, written in plpgsql, take p_organization_id, and don't
-- check membership yet. Each gets
--     PERFORM public.assert_org_member(p_organization_id);
-- as the first statement after BEGIN. Re-running is a no-op.

DO $$
DECLARE
  fn RECORD;
  def TEXT;
  patched TEXT;
  begin_pos INT;
BEGIN
  FOR fn IN
    SELECT p.oid, p.oid::regprocedure AS signature
    FROM pg_proc p
    JOIN pg_namespace n ON n.oid = p.pronamespace
    JOIN pg_language l ON l.oid = p.prolang
    WHERE n.nspname = 'public'
      AND (p.proname LIKE 'get\_%\_stats' OR p.proname LIKE 'get\_%\_report')
      AND p.prosecdef
      AND l.lanname = 'plpgsql'
      AND 'p_organization_id' = ANY (p.proargnames)
  LOOP
    def := pg_get_functiondef(fn.oid);

    IF position('assert_org_member' IN def) > 0 THEN
      RAISE NOTICE 'already checked: %', fn.signature;
      CONTINUE;
    END IF;

    -- First BEGIN of the body (after DECLARE, if any).
    begin_pos := position(E'\nBEGIN' IN def);
    IF begin_pos = 0 THEN
      RAISE WARNING 'no BEGIN found, not patched: %', fn.signature;
      CONTINUE;
    END IF;

    patched := substr(def, 1, begin_pos + length(E'\nBEGIN') - 1)
      || E'\n    PERFORM public.assert_org_member(p_organization_id);'
      || substr(def, begin_pos + length(E'\nBEGIN'));

    EXECUTE patched;
    RAISE NOTICE 'patched: %', fn.signature;
  END LOOP;
END;
$$;
