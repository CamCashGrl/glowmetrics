-- Creator Collab Board
-- Adds collaboration-board tables, extends profiles/notifications, and wires
-- up RLS + triggers so all authorization lives in Postgres (never trust the
-- client). Nothing here is applied automatically — review before running
-- `supabase db push` (or applying via the dashboard) against the live project.

-- ─── PROFILES: collab-facing fields ─────────────────────────────────────────
-- Additive only. Existing profiles.* RLS (auth.uid() = id) is untouched;
-- cross-user visibility is handled by the collab_public_profiles view below.
ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS avatar_url text,
  ADD COLUMN IF NOT EXISTS bio text,
  ADD COLUMN IF NOT EXISTS creator_niche text,
  ADD COLUMN IF NOT EXISTS region text,
  ADD COLUMN IF NOT EXISTS experience_level text,
  ADD COLUMN IF NOT EXISTS social_links jsonb NOT NULL DEFAULT '{}'::jsonb,
  ADD COLUMN IF NOT EXISTS is_verified boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS collab_visible boolean NOT NULL DEFAULT true;

DO $$ BEGIN
  ALTER TABLE public.profiles ADD CONSTRAINT profiles_bio_len CHECK (bio IS NULL OR char_length(bio) <= 600);
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  ALTER TABLE public.profiles ADD CONSTRAINT profiles_experience_level_valid
    CHECK (experience_level IS NULL OR experience_level IN ('new_creator','some_experience','experienced','veteran'));
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- ─── NOTIFICATIONS: generic extensions (existing admin-broadcast table) ─────
-- CamCash already has a notifications/notification_replies pair (admin -> user
-- broadcast, with no UI built for it yet). We extend rather than duplicate:
-- these two nullable columns let any notification (collab or otherwise) carry
-- a destination link and a machine-readable type for the bell UI.
ALTER TABLE public.notifications
  ADD COLUMN IF NOT EXISTS link_url text,
  ADD COLUMN IF NOT EXISTS notification_type text NOT NULL DEFAULT 'system';

-- ─── COLLAB POSTS ────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.collab_posts (
  id                        uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id                   uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  title                     text NOT NULL,
  description               text NOT NULL,
  collab_type               text NOT NULL,
  platforms                 text[] NOT NULL DEFAULT '{}',
  participation_mode        text NOT NULL DEFAULT 'either',
  city                      text,
  state_or_region           text,
  proposed_date             date,
  date_is_flexible          boolean NOT NULL DEFAULT false,
  creator_niche             text,
  experience_preference     text NOT NULL DEFAULT 'any',
  audience_size_preference  text,
  goals                     text,
  requirements              text,
  boundaries                text,
  tags                      text[] NOT NULL DEFAULT '{}',
  age_requirement           smallint,
  status                    text NOT NULL DEFAULT 'open',
  interested_count          integer NOT NULL DEFAULT 0,
  expires_at                timestamptz,
  admin_removed             boolean NOT NULL DEFAULT false,
  admin_removal_reason      text,
  created_at                timestamptz NOT NULL DEFAULT now(),
  updated_at                timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT collab_posts_title_len CHECK (char_length(title) BETWEEN 3 AND 120),
  CONSTRAINT collab_posts_description_len CHECK (char_length(description) BETWEEN 10 AND 4000),
  CONSTRAINT collab_posts_goals_len CHECK (goals IS NULL OR char_length(goals) <= 2000),
  CONSTRAINT collab_posts_requirements_len CHECK (requirements IS NULL OR char_length(requirements) <= 2000),
  CONSTRAINT collab_posts_boundaries_len CHECK (boundaries IS NULL OR char_length(boundaries) <= 2000),
  CONSTRAINT collab_posts_city_len CHECK (city IS NULL OR char_length(city) <= 80),
  CONSTRAINT collab_posts_region_len CHECK (state_or_region IS NULL OR char_length(state_or_region) <= 80),
  CONSTRAINT collab_posts_niche_len CHECK (creator_niche IS NULL OR char_length(creator_niche) <= 60),
  CONSTRAINT collab_posts_audience_len CHECK (audience_size_preference IS NULL OR char_length(audience_size_preference) <= 60),
  CONSTRAINT collab_posts_type_valid CHECK (collab_type IN (
    'battle','duo_stream','group_stream','content_creation','social_promotion',
    'photoshoot','travel_collaboration','coworking_accountability','other'
  )),
  CONSTRAINT collab_posts_mode_valid CHECK (participation_mode IN ('online','in_person','either')),
  CONSTRAINT collab_posts_status_valid CHECK (status IN ('open','matched','closed','expired','removed')),
  CONSTRAINT collab_posts_experience_valid CHECK (experience_preference IN ('any','new_creator','some_experience','experienced','veteran')),
  CONSTRAINT collab_posts_age_valid CHECK (age_requirement IS NULL OR age_requirement >= 18),
  CONSTRAINT collab_posts_tags_count CHECK (array_length(tags,1) IS NULL OR array_length(tags,1) <= 10),
  CONSTRAINT collab_posts_platforms_nonempty CHECK (array_length(platforms,1) IS NOT NULL),
  CONSTRAINT collab_posts_platforms_valid CHECK (platforms <@ ARRAY[
    'chaturbate','bongacams','myfreecams','stripchat','camsoda','onlyfans',
    'fansly','manyvids','social_media','multiple_platforms','other'
  ]::text[])
);

-- ─── COLLAB INTERESTS ────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.collab_interests (
  id                    uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  collab_post_id        uuid NOT NULL REFERENCES public.collab_posts(id) ON DELETE CASCADE,
  interested_user_id    uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  introduction_message  text,
  status                text NOT NULL DEFAULT 'pending',
  created_at            timestamptz NOT NULL DEFAULT now(),
  updated_at            timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT collab_interests_unique UNIQUE (collab_post_id, interested_user_id),
  CONSTRAINT collab_interests_status_valid CHECK (status IN ('pending','accepted','maybe','declined','withdrawn')),
  CONSTRAINT collab_interests_message_len CHECK (introduction_message IS NULL OR char_length(introduction_message) <= 1000)
);

-- ─── COLLAB SAVED POSTS ──────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.collab_saved_posts (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id         uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  collab_post_id  uuid NOT NULL REFERENCES public.collab_posts(id) ON DELETE CASCADE,
  created_at      timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT collab_saved_posts_unique UNIQUE (user_id, collab_post_id)
);

-- ─── COLLAB REPORTS ──────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.collab_reports (
  id                  uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  reporter_user_id    uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  collab_post_id      uuid REFERENCES public.collab_posts(id) ON DELETE CASCADE,
  reported_user_id    uuid REFERENCES auth.users(id) ON DELETE CASCADE,
  reason              text NOT NULL,
  details             text,
  status              text NOT NULL DEFAULT 'open',
  created_at          timestamptz NOT NULL DEFAULT now(),
  reviewed_at         timestamptz,
  CONSTRAINT collab_reports_reason_valid CHECK (reason IN (
    'spam','harassment','illegal_activity','minor_safety','scam_or_fraud','inappropriate_content','other'
  )),
  CONSTRAINT collab_reports_status_valid CHECK (status IN ('open','reviewing','actioned','dismissed')),
  CONSTRAINT collab_reports_details_len CHECK (details IS NULL OR char_length(details) <= 2000),
  CONSTRAINT collab_reports_target CHECK (collab_post_id IS NOT NULL OR reported_user_id IS NOT NULL)
);

-- ─── COLLAB CONVERSATIONS + MESSAGES ─────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.collab_conversations (
  id                  uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  collab_post_id      uuid NOT NULL REFERENCES public.collab_posts(id) ON DELETE CASCADE,
  owner_user_id       uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  interested_user_id  uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  created_at          timestamptz NOT NULL DEFAULT now(),
  updated_at          timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT collab_conversations_unique UNIQUE (collab_post_id, interested_user_id),
  CONSTRAINT collab_conversations_distinct CHECK (owner_user_id <> interested_user_id)
);

CREATE TABLE IF NOT EXISTS public.collab_messages (
  id                uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  conversation_id   uuid NOT NULL REFERENCES public.collab_conversations(id) ON DELETE CASCADE,
  sender_user_id    uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  message           text NOT NULL,
  created_at        timestamptz NOT NULL DEFAULT now(),
  read_at           timestamptz,
  CONSTRAINT collab_messages_len CHECK (char_length(message) BETWEEN 1 AND 2000)
);

-- ─── COLLAB BLOCKS (safety: block user) ──────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.collab_blocks (
  id                uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  blocker_user_id   uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  blocked_user_id   uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  created_at        timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT collab_blocks_unique UNIQUE (blocker_user_id, blocked_user_id),
  CONSTRAINT collab_blocks_distinct CHECK (blocker_user_id <> blocked_user_id)
);

-- ─── INDEXES ─────────────────────────────────────────────────────────────────
CREATE INDEX IF NOT EXISTS collab_posts_status_idx ON public.collab_posts (status, created_at DESC);
CREATE INDEX IF NOT EXISTS collab_posts_user_idx ON public.collab_posts (user_id);
CREATE INDEX IF NOT EXISTS collab_posts_type_idx ON public.collab_posts (collab_type);
CREATE INDEX IF NOT EXISTS collab_posts_platforms_idx ON public.collab_posts USING gin (platforms);
CREATE INDEX IF NOT EXISTS collab_posts_tags_idx ON public.collab_posts USING gin (tags);
CREATE INDEX IF NOT EXISTS collab_interests_post_idx ON public.collab_interests (collab_post_id);
CREATE INDEX IF NOT EXISTS collab_interests_user_idx ON public.collab_interests (interested_user_id);
CREATE INDEX IF NOT EXISTS collab_saved_posts_user_idx ON public.collab_saved_posts (user_id);
CREATE INDEX IF NOT EXISTS collab_conversations_owner_idx ON public.collab_conversations (owner_user_id);
CREATE INDEX IF NOT EXISTS collab_conversations_interested_idx ON public.collab_conversations (interested_user_id);
CREATE INDEX IF NOT EXISTS collab_messages_conversation_idx ON public.collab_messages (conversation_id, created_at);
CREATE INDEX IF NOT EXISTS collab_reports_reporter_idx ON public.collab_reports (reporter_user_id);
CREATE INDEX IF NOT EXISTS collab_blocks_blocker_idx ON public.collab_blocks (blocker_user_id);

-- ─── HELPER FUNCTIONS ────────────────────────────────────────────────────────

-- Mutual block check, used inside RLS policies.
CREATE OR REPLACE FUNCTION public.collab_is_blocked(a uuid, b uuid)
RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.collab_blocks
    WHERE (blocker_user_id = a AND blocked_user_id = b)
       OR (blocker_user_id = b AND blocked_user_id = a)
  );
$$;

GRANT EXECUTE ON FUNCTION public.collab_is_blocked(uuid, uuid) TO authenticated;

CREATE OR REPLACE FUNCTION public.collab_set_updated_at()
RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

CREATE TRIGGER collab_posts_set_updated_at BEFORE UPDATE ON public.collab_posts
  FOR EACH ROW EXECUTE FUNCTION public.collab_set_updated_at();
CREATE TRIGGER collab_conversations_set_updated_at BEFORE UPDATE ON public.collab_conversations
  FOR EACH ROW EXECUTE FUNCTION public.collab_set_updated_at();

-- Posts: rate limit (max 8 per rolling 24h per creator).
CREATE OR REPLACE FUNCTION public.collab_posts_before_insert()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v_count int;
BEGIN
  SELECT count(*) INTO v_count FROM public.collab_posts
  WHERE user_id = NEW.user_id AND created_at > now() - interval '24 hours';
  IF v_count >= 8 THEN
    RAISE EXCEPTION 'rate_limit_exceeded: too many collab posts in 24 hours' USING ERRCODE = 'P0001';
  END IF;
  RETURN NEW;
END;
$$;
CREATE TRIGGER collab_posts_rate_limit BEFORE INSERT ON public.collab_posts
  FOR EACH ROW EXECUTE FUNCTION public.collab_posts_before_insert();

-- Interests: block posting to a non-open post + rate limit (max 40 / 24h).
CREATE OR REPLACE FUNCTION public.collab_interests_before_insert()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v_count int; v_status text;
BEGIN
  SELECT status INTO v_status FROM public.collab_posts WHERE id = NEW.collab_post_id;
  IF v_status IS DISTINCT FROM 'open' THEN
    RAISE EXCEPTION 'post_not_open: this collaboration is no longer accepting interest' USING ERRCODE = 'P0001';
  END IF;

  SELECT count(*) INTO v_count FROM public.collab_interests
  WHERE interested_user_id = NEW.interested_user_id AND created_at > now() - interval '24 hours';
  IF v_count >= 40 THEN
    RAISE EXCEPTION 'rate_limit_exceeded: too many interest submissions in 24 hours' USING ERRCODE = 'P0001';
  END IF;

  RETURN NEW;
END;
$$;
CREATE TRIGGER collab_interests_rate_limit BEFORE INSERT ON public.collab_interests
  FOR EACH ROW EXECUTE FUNCTION public.collab_interests_before_insert();

-- Interests: notify post owner.
CREATE OR REPLACE FUNCTION public.collab_interests_after_insert()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v_owner uuid; v_title text;
BEGIN
  SELECT user_id, title INTO v_owner, v_title FROM public.collab_posts WHERE id = NEW.collab_post_id;

  INSERT INTO public.notifications (user_id, sender_type, sender_id, subject, body, notification_type, link_url)
  VALUES (
    v_owner, 'system', 'collab_board',
    'New interest in your collab post',
    'Someone is interested in collaborating on "' || v_title || '".',
    'collab_interest',
    '/collabs/' || NEW.collab_post_id
  );
  RETURN NEW;
END;
$$;
CREATE TRIGGER collab_interests_notify AFTER INSERT ON public.collab_interests
  FOR EACH ROW EXECUTE FUNCTION public.collab_interests_after_insert();

-- Interests: guard which party may set which status, and lock immutable fields.
CREATE OR REPLACE FUNCTION public.collab_interests_before_update()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v_post_owner uuid;
BEGIN
  SELECT user_id INTO v_post_owner FROM public.collab_posts WHERE id = OLD.collab_post_id;

  IF NEW.status IS DISTINCT FROM OLD.status THEN
    IF auth.uid() = OLD.interested_user_id THEN
      IF NEW.status <> 'withdrawn' THEN
        RAISE EXCEPTION 'not_allowed: interested creator may only withdraw' USING ERRCODE = 'P0001';
      END IF;
    ELSIF auth.uid() = v_post_owner THEN
      IF NEW.status NOT IN ('accepted','declined','maybe') THEN
        RAISE EXCEPTION 'not_allowed: post owner may only accept, decline, or mark maybe' USING ERRCODE = 'P0001';
      END IF;
    END IF;
  END IF;

  NEW.collab_post_id := OLD.collab_post_id;
  NEW.interested_user_id := OLD.interested_user_id;
  NEW.created_at := OLD.created_at;

  RETURN NEW;
END;
$$;
CREATE TRIGGER collab_interests_guard BEFORE UPDATE ON public.collab_interests
  FOR EACH ROW EXECUTE FUNCTION public.collab_interests_before_update();

-- Interests: notify interested creator on status change.
CREATE OR REPLACE FUNCTION public.collab_interests_after_update()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v_title text; v_label text;
BEGIN
  IF NEW.status IS DISTINCT FROM OLD.status AND NEW.status IN ('accepted','declined','maybe') THEN
    SELECT title INTO v_title FROM public.collab_posts WHERE id = NEW.collab_post_id;
    v_label := CASE NEW.status WHEN 'accepted' THEN 'accepted' WHEN 'declined' THEN 'declined' ELSE 'marked as maybe' END;

    INSERT INTO public.notifications (user_id, sender_type, sender_id, subject, body, notification_type, link_url)
    VALUES (
      NEW.interested_user_id, 'system', 'collab_board',
      'Your collab interest was ' || v_label,
      'Your interest in "' || v_title || '" was ' || v_label || '.',
      'collab_interest_status',
      '/collabs/' || NEW.collab_post_id
    );
  END IF;
  RETURN NEW;
END;
$$;
CREATE TRIGGER collab_interests_notify_status AFTER UPDATE ON public.collab_interests
  FOR EACH ROW EXECUTE FUNCTION public.collab_interests_after_update();

-- Interests: keep collab_posts.interested_count in sync (full recount, no drift).
CREATE OR REPLACE FUNCTION public.collab_recount_interests()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v_post_id uuid;
BEGIN
  v_post_id := COALESCE(NEW.collab_post_id, OLD.collab_post_id);
  UPDATE public.collab_posts
  SET interested_count = (
    SELECT count(*) FROM public.collab_interests
    WHERE collab_post_id = v_post_id AND status <> 'withdrawn'
  )
  WHERE id = v_post_id;
  RETURN NULL;
END;
$$;
CREATE TRIGGER collab_interests_recount AFTER INSERT OR UPDATE OR DELETE ON public.collab_interests
  FOR EACH ROW EXECUTE FUNCTION public.collab_recount_interests();

-- Messages: rate limit (max 60 / hour per sender) + notify recipient + bump conversation.
CREATE OR REPLACE FUNCTION public.collab_messages_before_insert()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v_count int;
BEGIN
  SELECT count(*) INTO v_count FROM public.collab_messages
  WHERE sender_user_id = NEW.sender_user_id AND created_at > now() - interval '1 hour';
  IF v_count >= 60 THEN
    RAISE EXCEPTION 'rate_limit_exceeded: too many messages sent' USING ERRCODE = 'P0001';
  END IF;
  RETURN NEW;
END;
$$;
CREATE TRIGGER collab_messages_rate_limit BEFORE INSERT ON public.collab_messages
  FOR EACH ROW EXECUTE FUNCTION public.collab_messages_before_insert();

CREATE OR REPLACE FUNCTION public.collab_messages_after_insert()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v_owner uuid; v_interested uuid; v_recipient uuid;
BEGIN
  SELECT owner_user_id, interested_user_id INTO v_owner, v_interested
  FROM public.collab_conversations WHERE id = NEW.conversation_id;

  v_recipient := CASE WHEN NEW.sender_user_id = v_owner THEN v_interested ELSE v_owner END;

  UPDATE public.collab_conversations SET updated_at = now() WHERE id = NEW.conversation_id;

  INSERT INTO public.notifications (user_id, sender_type, sender_id, subject, body, notification_type, link_url)
  VALUES (
    v_recipient, 'system', 'collab_board',
    'New collab message',
    'You have a new message about a collaboration.',
    'collab_message',
    '/collabs/conversations/' || NEW.conversation_id
  );
  RETURN NEW;
END;
$$;
CREATE TRIGGER collab_messages_notify AFTER INSERT ON public.collab_messages
  FOR EACH ROW EXECUTE FUNCTION public.collab_messages_after_insert();

-- Messages: only read_at may ever be changed after the fact (mark-as-read).
CREATE OR REPLACE FUNCTION public.collab_messages_before_update()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF NEW.message IS DISTINCT FROM OLD.message
     OR NEW.sender_user_id IS DISTINCT FROM OLD.sender_user_id
     OR NEW.conversation_id IS DISTINCT FROM OLD.conversation_id
     OR NEW.created_at IS DISTINCT FROM OLD.created_at THEN
    RAISE EXCEPTION 'not_allowed: only read_at may be updated' USING ERRCODE = 'P0001';
  END IF;
  RETURN NEW;
END;
$$;
CREATE TRIGGER collab_messages_guard BEFORE UPDATE ON public.collab_messages
  FOR EACH ROW EXECUTE FUNCTION public.collab_messages_before_update();

-- Reports: rate limit (max 20 / 24h per reporter).
CREATE OR REPLACE FUNCTION public.collab_reports_before_insert()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v_count int;
BEGIN
  SELECT count(*) INTO v_count FROM public.collab_reports
  WHERE reporter_user_id = NEW.reporter_user_id AND created_at > now() - interval '24 hours';
  IF v_count >= 20 THEN
    RAISE EXCEPTION 'rate_limit_exceeded: too many reports submitted' USING ERRCODE = 'P0001';
  END IF;
  RETURN NEW;
END;
$$;
CREATE TRIGGER collab_reports_rate_limit BEFORE INSERT ON public.collab_reports
  FOR EACH ROW EXECUTE FUNCTION public.collab_reports_before_insert();

-- ─── PUBLIC-SAFE PROFILE VIEW ────────────────────────────────────────────────
-- profiles RLS is `auth.uid() = id` only, so no one can see another creator's
-- name/avatar today. This view exposes a narrow, non-sensitive column subset
-- (never legal name, address, phone, email, or exact location — none of which
-- exist on profiles anyway) for creators who've engaged with the collab board.
-- security_invoker defaults to false: the view runs with the *owner's*
-- privileges (this migration's role, which owns public.profiles), so it reads
-- past the restrictive per-row profiles policy — the WHERE clause below is
-- what actually keeps this narrow and intentional, not the RLS bypass itself.
CREATE OR REPLACE VIEW public.collab_public_profiles
WITH (security_invoker = false) AS
SELECT
  p.id,
  p.display_name,
  p.avatar_url,
  p.bio,
  p.creator_niche,
  p.region,
  p.experience_level,
  p.is_verified,
  p.social_links,
  p.created_at AS member_since
FROM public.profiles p
WHERE p.collab_visible = true
  AND (
    p.id = auth.uid()
    OR EXISTS (SELECT 1 FROM public.collab_posts cp WHERE cp.user_id = p.id)
    OR EXISTS (SELECT 1 FROM public.collab_interests ci WHERE ci.interested_user_id = p.id)
  );

GRANT SELECT ON public.collab_public_profiles TO authenticated;

-- ─── ROW LEVEL SECURITY ──────────────────────────────────────────────────────
ALTER TABLE public.collab_posts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.collab_interests ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.collab_saved_posts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.collab_reports ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.collab_conversations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.collab_messages ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.collab_blocks ENABLE ROW LEVEL SECURITY;

-- collab_posts: open (non-expired) posts are publicly readable by any
-- authenticated user; owners always see their own; a creator who applied to a
-- post keeps seeing it even after it closes/expires. Removed posts are never
-- visible to anyone but the owner. Blocked authors are hidden from each other.
CREATE POLICY collab_posts_select ON public.collab_posts
  FOR SELECT TO authenticated
  USING (
    user_id = auth.uid()
    OR (
      status <> 'removed'
      AND NOT public.collab_is_blocked(auth.uid(), user_id)
      AND (
        (status = 'open' AND (expires_at IS NULL OR expires_at > now()))
        OR EXISTS (SELECT 1 FROM public.collab_interests ci WHERE ci.collab_post_id = collab_posts.id AND ci.interested_user_id = auth.uid())
      )
    )
  );

CREATE POLICY collab_posts_insert ON public.collab_posts
  FOR INSERT TO authenticated
  WITH CHECK (user_id = auth.uid());

CREATE POLICY collab_posts_update ON public.collab_posts
  FOR UPDATE TO authenticated
  USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());

CREATE POLICY collab_posts_delete ON public.collab_posts
  FOR DELETE TO authenticated
  USING (user_id = auth.uid());

-- collab_interests: visible to the interested creator and the post owner only.
CREATE POLICY collab_interests_select ON public.collab_interests
  FOR SELECT TO authenticated
  USING (
    interested_user_id = auth.uid()
    OR EXISTS (SELECT 1 FROM public.collab_posts p WHERE p.id = collab_post_id AND p.user_id = auth.uid())
  );

CREATE POLICY collab_interests_insert ON public.collab_interests
  FOR INSERT TO authenticated
  WITH CHECK (
    interested_user_id = auth.uid()
    AND NOT EXISTS (SELECT 1 FROM public.collab_posts p WHERE p.id = collab_post_id AND p.user_id = auth.uid())
    AND NOT public.collab_is_blocked(auth.uid(), (SELECT user_id FROM public.collab_posts WHERE id = collab_post_id))
  );

CREATE POLICY collab_interests_update ON public.collab_interests
  FOR UPDATE TO authenticated
  USING (
    interested_user_id = auth.uid()
    OR EXISTS (SELECT 1 FROM public.collab_posts p WHERE p.id = collab_post_id AND p.user_id = auth.uid())
  )
  WITH CHECK (
    interested_user_id = auth.uid()
    OR EXISTS (SELECT 1 FROM public.collab_posts p WHERE p.id = collab_post_id AND p.user_id = auth.uid())
  );

-- collab_saved_posts: private to the saving user.
CREATE POLICY collab_saved_posts_select ON public.collab_saved_posts
  FOR SELECT TO authenticated USING (user_id = auth.uid());
CREATE POLICY collab_saved_posts_insert ON public.collab_saved_posts
  FOR INSERT TO authenticated WITH CHECK (user_id = auth.uid());
CREATE POLICY collab_saved_posts_delete ON public.collab_saved_posts
  FOR DELETE TO authenticated USING (user_id = auth.uid());

-- collab_reports: reporter can create + see their own; admin review happens
-- through the existing service-role admin API (bypasses RLS), same pattern as
-- the rest of the admin panel — no client-facing "admin" RLS role exists here.
CREATE POLICY collab_reports_select ON public.collab_reports
  FOR SELECT TO authenticated USING (reporter_user_id = auth.uid());
CREATE POLICY collab_reports_insert ON public.collab_reports
  FOR INSERT TO authenticated WITH CHECK (reporter_user_id = auth.uid());

-- collab_conversations: visible to both participants; only the post owner can
-- start one, and only with a creator who has actually expressed interest.
CREATE POLICY collab_conversations_select ON public.collab_conversations
  FOR SELECT TO authenticated
  USING (owner_user_id = auth.uid() OR interested_user_id = auth.uid());

CREATE POLICY collab_conversations_insert ON public.collab_conversations
  FOR INSERT TO authenticated
  WITH CHECK (
    owner_user_id = auth.uid()
    AND EXISTS (SELECT 1 FROM public.collab_posts p WHERE p.id = collab_post_id AND p.user_id = auth.uid())
    AND EXISTS (SELECT 1 FROM public.collab_interests ci WHERE ci.collab_post_id = collab_conversations.collab_post_id AND ci.interested_user_id = collab_conversations.interested_user_id)
    AND NOT public.collab_is_blocked(owner_user_id, interested_user_id)
  );

-- collab_messages: only visible/sendable by the two conversation participants.
CREATE POLICY collab_messages_select ON public.collab_messages
  FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.collab_conversations c
      WHERE c.id = conversation_id AND (c.owner_user_id = auth.uid() OR c.interested_user_id = auth.uid())
    )
  );

CREATE POLICY collab_messages_insert ON public.collab_messages
  FOR INSERT TO authenticated
  WITH CHECK (
    sender_user_id = auth.uid()
    AND EXISTS (
      SELECT 1 FROM public.collab_conversations c
      WHERE c.id = conversation_id
        AND (c.owner_user_id = auth.uid() OR c.interested_user_id = auth.uid())
        AND NOT public.collab_is_blocked(c.owner_user_id, c.interested_user_id)
    )
  );

CREATE POLICY collab_messages_update ON public.collab_messages
  FOR UPDATE TO authenticated
  USING (
    EXISTS (SELECT 1 FROM public.collab_conversations c WHERE c.id = conversation_id AND (c.owner_user_id = auth.uid() OR c.interested_user_id = auth.uid()))
  )
  WITH CHECK (
    EXISTS (SELECT 1 FROM public.collab_conversations c WHERE c.id = conversation_id AND (c.owner_user_id = auth.uid() OR c.interested_user_id = auth.uid()))
  );

-- collab_blocks: private to the blocking user.
CREATE POLICY collab_blocks_select ON public.collab_blocks
  FOR SELECT TO authenticated USING (blocker_user_id = auth.uid());
CREATE POLICY collab_blocks_insert ON public.collab_blocks
  FOR INSERT TO authenticated WITH CHECK (blocker_user_id = auth.uid());
CREATE POLICY collab_blocks_delete ON public.collab_blocks
  FOR DELETE TO authenticated USING (blocker_user_id = auth.uid());

-- ─── REALTIME ────────────────────────────────────────────────────────────────
-- Powers the live message feed in the conversation panel (mirrors how
-- live_tips/live_sessions are already published for the Live Mode tab).
DO $$ BEGIN
  ALTER PUBLICATION supabase_realtime ADD TABLE public.collab_messages;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
