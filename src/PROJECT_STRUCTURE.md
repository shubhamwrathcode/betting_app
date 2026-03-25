# Betting App Structure

This structure is prepared to mirror the web project flow while staying React Native friendly.

## Core folders

- `app`: app bootstrapping and root wrappers
- `navigation`: route orchestration
- `screens`: screen-level UI modules (auth, home, sportsbook, wallet, etc.)
- `components`: reusable UI components
- `api`: base API client + endpoints
- `services`: feature-level API/business calls
- `context`: app-wide providers
- `hooks`: reusable hooks
- `types`: shared TypeScript types
- `theme`: colors and design tokens
- `utils`: helper constants and utility functions
- `store`: reserved for global state layer

## Next steps

1. Map each `betting_web/src` module to corresponding mobile `screens`.
2. Replace placeholder endpoints with real API config from web project.
3. Add authentication persistence and secure token storage.
4. Introduce stack/tab navigation package and real screen routes.
