// Typed database interfaces for the Collab Board.
// This repo is plain JS (no tsconfig/typescript dependency) — these JSDoc
// typedefs give editor autocomplete + `// @ts-check` support without
// introducing a TypeScript build step. Keep in sync with the migration in
// supabase/migrations/20260716192202_create_collab_board.sql.

/**
 * @typedef {'battle'|'duo_stream'|'group_stream'|'content_creation'|'social_promotion'|'photoshoot'|'travel_collaboration'|'coworking_accountability'|'other'} CollabType
 * @typedef {'chaturbate'|'bongacams'|'myfreecams'|'stripchat'|'camsoda'|'onlyfans'|'fansly'|'manyvids'|'social_media'|'multiple_platforms'|'other'} Platform
 * @typedef {'online'|'in_person'|'either'} ParticipationMode
 * @typedef {'any'|'new_creator'|'some_experience'|'experienced'|'veteran'} ExperienceLevel
 * @typedef {'open'|'matched'|'closed'|'expired'|'removed'} CollabPostStatus
 * @typedef {'pending'|'accepted'|'maybe'|'declined'|'withdrawn'} CollabInterestStatus
 * @typedef {'spam'|'harassment'|'illegal_activity'|'minor_safety'|'scam_or_fraud'|'inappropriate_content'|'other'} ReportReason
 */

/**
 * @typedef {Object} CollabPost
 * @property {string} id
 * @property {string} user_id
 * @property {string} title
 * @property {string} description
 * @property {CollabType} collab_type
 * @property {Platform[]} platforms
 * @property {ParticipationMode} participation_mode
 * @property {string|null} city
 * @property {string|null} state_or_region
 * @property {string|null} proposed_date
 * @property {boolean} date_is_flexible
 * @property {string|null} creator_niche
 * @property {ExperienceLevel} experience_preference
 * @property {string|null} audience_size_preference
 * @property {string|null} goals
 * @property {string|null} requirements
 * @property {string|null} boundaries
 * @property {string[]} tags
 * @property {number|null} age_requirement
 * @property {CollabPostStatus} status
 * @property {number} interested_count
 * @property {string|null} expires_at
 * @property {boolean} admin_removed
 * @property {string|null} admin_removal_reason
 * @property {string} created_at
 * @property {string} updated_at
 */

/**
 * @typedef {Object} CollabInterest
 * @property {string} id
 * @property {string} collab_post_id
 * @property {string} interested_user_id
 * @property {string|null} introduction_message
 * @property {CollabInterestStatus} status
 * @property {string} created_at
 * @property {string} updated_at
 */

/**
 * @typedef {Object} CollabSavedPost
 * @property {string} id
 * @property {string} user_id
 * @property {string} collab_post_id
 * @property {string} created_at
 */

/**
 * @typedef {Object} CollabReport
 * @property {string} id
 * @property {string} reporter_user_id
 * @property {string|null} collab_post_id
 * @property {string|null} reported_user_id
 * @property {ReportReason} reason
 * @property {string|null} details
 * @property {'open'|'reviewing'|'actioned'|'dismissed'} status
 * @property {string} created_at
 * @property {string|null} reviewed_at
 */

/**
 * @typedef {Object} CollabConversation
 * @property {string} id
 * @property {string} collab_post_id
 * @property {string} owner_user_id
 * @property {string} interested_user_id
 * @property {string} created_at
 * @property {string} updated_at
 */

/**
 * @typedef {Object} CollabMessage
 * @property {string} id
 * @property {string} conversation_id
 * @property {string} sender_user_id
 * @property {string} message
 * @property {string} created_at
 * @property {string|null} read_at
 */

/**
 * @typedef {Object} CollabBlock
 * @property {string} id
 * @property {string} blocker_user_id
 * @property {string} blocked_user_id
 * @property {string} created_at
 */

/**
 * @typedef {Object} CollabPublicProfile
 * @property {string} id
 * @property {string|null} display_name
 * @property {string|null} avatar_url
 * @property {string|null} bio
 * @property {string|null} creator_niche
 * @property {string|null} region
 * @property {ExperienceLevel|null} experience_level
 * @property {boolean} is_verified
 * @property {Object.<string,string>} social_links
 * @property {string} member_since
 */

export {}
