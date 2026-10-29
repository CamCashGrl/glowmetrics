-- After running both rollbacks (B first, then A).

SELECT t.ok(format_type(atttypid, atttypmod) = 'numeric(10,2)', 'rollback B: tips.usd back to numeric(10,2)')
  FROM pg_attribute WHERE attrelid = 'public.tips'::regclass AND attname = 'usd';
SELECT t.ok(format_type(atttypid, atttypmod) = 'numeric(10,2)', 'rollback B: live_tips.usd back to numeric(10,2)')
  FROM pg_attribute WHERE attrelid = 'public.live_tips'::regclass AND attname = 'usd';
SELECT t.ok(pg_get_indexdef('public.tips_dedup_unique'::regclass)
            = 'CREATE UNIQUE INDEX tips_dedup_unique ON public.tips USING btree (user_id, username_lower, tokens, usd_rounded, date_time, tip_seq)',
            'rollback B: tips_dedup_unique definition identical');
SELECT t.assert_history_unchanged('after rollback');
-- Documented loss: rows written after B lose sub-cent precision on rollback.
SELECT t.ok((SELECT usd FROM public.tips WHERE username = 'ramp' AND tokens = 1) = 0.03,
            'rollback B: post-B 1-token BongaCams row narrows 0.0250 -> 0.03 (documented lossy rollback)');

SELECT t.ok(has_table_privilege('anon', 'public.tips', 'TRUNCATE')
        AND has_table_privilege('anon', 'public.live_tips', 'INSERT')
        AND has_table_privilege('anon', 'public.coaching_events', 'DELETE'),
            'rollback A: prior anon grants restored exactly');
