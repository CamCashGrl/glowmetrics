-- Widens tip_menus.style to support the full set of 14 tip-menu types
-- (Creator Profile Studio Phase 3). Previously limited to
-- ('balanced', 'high_engagement', 'premium').
-- NOT YET APPLIED — see delivery report; apply only after review.

ALTER TABLE public.tip_menus DROP CONSTRAINT IF EXISTS tip_menus_style_check;

ALTER TABLE public.tip_menus ADD CONSTRAINT tip_menus_style_check
  CHECK (style IN (
    'balanced', 'high_engagement', 'premium', 'beginner_friendly', 'non_nude',
    'toy_focused', 'game_focused', 'dominant_persona', 'submissive_persona',
    'girlfriend_experience', 'private_show_conversion', 'goal_focused',
    'short_menu', 'full_menu'
  ));
