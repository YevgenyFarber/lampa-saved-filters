# Lampa: Saved filters

Lampa plugin that saves the built-in catalog filter (menu → Filter) so it can be reopened later.

Install: Settings → Extensions → add

    https://yevgenyfarber.github.io/lampa-saved-filters/saved_filters.js

Use: Filter → pick options → **Save & search** (name it). Filter → **Saved filters** → click a filter to apply it, hold OK for Open / Edit / copy / Delete. Edit loads its options back into Filter; save with a new name to clone, same name to update.

Filter also gets two extra options (TMDB source only):
- **Keyword** (tick one or more) → **True crime** (TMDB keyword 33722; TMDB has no true-crime genre), **Interrogation** (keywords 15271 | 166582). Combine with the Documentary genre for docs.
- **Keywords: match** → **All ticked (AND)**: titles tagged with every ticked keyword (main tag each, as TMDB can't mix AND/OR), or **Any ticked (OR)**: titles with any of them.
- **Streaming (US)** → Netflix, Amazon Prime Video, Disney+, HBO Max, Apple TV+, Hulu, Paramount+, Peacock: only titles available on that service in the US catalogue.
- **Sort** → **Newest first** (default: release / first-air date, unreleased titles left out), **Oldest first**, **Most popular**. Saved filters from before this option open newest first. Hidden on the CUB source, which has its own Sort.

Test: `node test.js`
