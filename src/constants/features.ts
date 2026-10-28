// Keep Arcana's implementation and saved collection, but disable its UI and
// task-completion rewards until the feature is enabled again intentionally.
export const ARCANA_ENABLED = false;
// Connected environments opt in only after their additive Notes migration is qualified.
export const NOTES_PREVIEW_ENABLED = import.meta.env.VITE_AUTH_MODE !== 'supabase' || import.meta.env.VITE_ENABLE_NOTES_PREVIEW === 'true';
