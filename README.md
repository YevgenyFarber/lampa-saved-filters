# Lampa: Saved filters

Lampa plugin that saves the built-in catalog filter (menu → Filter) so it can be reopened later.

Install: Settings → Extensions → add

    https://yevgenyfarber.github.io/lampa-saved-filters/saved_filters.js

Use: Filter → pick options → **Save & search** (name it). Filter → **Saved filters** → click a filter to apply it, hold OK for Open / Edit / copy / Delete. Edit loads its options back into Filter; save with a new name to clone, same name to update.

Filter also gets two extra options (TMDB source only):
- **Keyword** → **True crime** (TMDB keyword 33722; TMDB has no true-crime genre) or **Interrogation** (keywords 15271 | 166582). Combine with the Documentary genre for docs.
- **Streaming (US)** → Netflix, Amazon Prime Video, Disney+, HBO Max, Apple TV+, Hulu, Paramount+, Peacock: only titles available on that service in the US catalogue.

Test: `node test.js`
