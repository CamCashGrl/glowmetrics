-- Bring the import-RPC mirror (captured 2026-11-01, already hardened by
-- 20261101) to the exact table/sequence ACLs read from production on
-- 2026-11-05 (pg_class.relacl), minus MAINTAIN, which Postgres 16 lacks:
--   paid_sessions         anon=arwdDxtm  authenticated=arwdDxtm  service_role=arwdDxtm
--   tips                  anon=rxtm      authenticated=arwdDxtm  service_role=arwdDxtm
--   paid_sessions_id_seq  anon=rwU       authenticated=rwU       service_role=rwU
REVOKE INSERT, UPDATE, DELETE, TRUNCATE ON public.tips FROM anon;           -- 20261029c (applied in production)
GRANT SELECT, UPDATE, USAGE ON SEQUENCE public.paid_sessions_id_seq TO anon, authenticated, service_role;

CREATE TABLE t.acl_baseline AS
SELECT c.relname, a.grantee::regrole::text AS grantee, a.privilege_type
FROM pg_class c, aclexplode(c.relacl) a
WHERE c.oid IN ('public.paid_sessions'::regclass, 'public.tips'::regclass, 'public.paid_sessions_id_seq'::regclass)
  AND a.grantee <> 0;

SELECT t.ok((SELECT string_agg(privilege_type, ',' ORDER BY privilege_type) FROM t.acl_baseline WHERE relname = 'paid_sessions' AND grantee = 'anon')
            = 'DELETE,INSERT,REFERENCES,SELECT,TRIGGER,TRUNCATE,UPDATE', 'prod state: anon paid_sessions = arwdDxt (+ MAINTAIN on 17)');
SELECT t.ok((SELECT string_agg(privilege_type, ',' ORDER BY privilege_type) FROM t.acl_baseline WHERE relname = 'tips' AND grantee = 'anon')
            = 'REFERENCES,SELECT,TRIGGER', 'prod state: anon tips = rxt (+ MAINTAIN on 17)');
SELECT t.ok((SELECT string_agg(privilege_type, ',' ORDER BY privilege_type) FROM t.acl_baseline WHERE relname = 'tips' AND grantee = 'authenticated')
            = 'DELETE,INSERT,REFERENCES,SELECT,TRIGGER,TRUNCATE,UPDATE', 'prod state: authenticated tips = arwdDxt (+ MAINTAIN on 17)');
SELECT t.ok((SELECT string_agg(privilege_type, ',' ORDER BY privilege_type) FROM t.acl_baseline WHERE relname = 'paid_sessions_id_seq' AND grantee = 'anon')
            = 'SELECT,UPDATE,USAGE', 'prod state: anon paid_sessions_id_seq = rwU');
