# STUDLY Frontend integration

Backend reference: `fd9011e5b557376c1bfe5a6f9e4379ca65e7eda4` ([contracts](https://github.com/lex44lh/Studly/blob/fd9011e5b557376c1bfe5a6f9e4379ca65e7eda4/REGISTRATION_API.md)).

## Explicit local modes

Updated18 October2026: [local startup guide](../../LOCAL_START.md). The two commands now verify the selected mode and port before launching. Live also checks Django health/ready/catalog/auth, then same-origin proxy/CSRF before announcing readiness. Legacy `api` is a compatibility alias for `live`; unknown modes still fail. No credentials or environment files are overwritten.

From the repository root:

```sh
npm run dev:demo
npm run dev:live
```

Run one command at a time on port 3000; stop the current process before switching. DEMO restores the existing static catalog, search/filters, categories, performer pages, favorites, local order/chat examples and development registration preview. It makes no auth or registration requests, never reports server registration success, and cannot charge a payment. The order example button explicitly creates only a local demo record. Existing browser data is preserved.

LIVE is still the default for ordinary dev and production builds. There is no automatic fallback when Django fails. Legacy sections retain their interface, but do not read demo/localStorage data in LIVE; unsupported controls are disabled. Category controls are preserved with an honest unavailable-data notice. Set NEXT_PUBLIC_STUDLY_DATA_MODE=demo only for an intentional demo run; changing it requires restart/rebuild, because Next inlines public variables. No local .env file is created by the regression fix.

## Run against Django

Start the Backend independently following its instructions. The Frontend does not contain or modify Django.

```sh
DJANGO_API_ORIGIN=http://127.0.0.1:8000 npm run dev:live
```

The server-only DJANGO_API_ORIGIN must contain an HTTP(S) origin without a path or credentials; default is http://127.0.0.1:8000. Restart Next after changing it. For a production build, set it during the build as rewrites are included in the build output. It is never a NEXT_PUBLIC variable. Use one consistent browser host. /api/ rewrites preserve Django trailing slashes; do not remove skipTrailingSlashRedirect. Infrastructure must agree on Django Host/Origin, trusted origins, HTTPS and cookies. No CORS bypass or server authentication override is included.

Client requests use same-origin cookies and no-store. Every mutation obtains a fresh CSRF token from JSON; HttpOnly cookies are never read in JS. Mutation failures are not automatically replayed. After a failure, the user reviews and retries; complete is confirmed only by the server. On registration 403 the client diagnoses the session through GET me without replaying the write. Files are sent with FormData and browser-generated multipart boundaries. Private avatar uses an unoptimized image with cookie on the same origin.

## Registration release gate

Registration remains development-only until real Django/Telegram integration has been validated. No browser flag bypasses the production gate. A saved step is restored by GET registration, including server is_complete. Forms PATCH only the relevant block on continuation; performer skip still calls complete. Unsaved keystrokes and files remain in React memory and can be lost on reload. Specializations loads all API pages and performs UI search locally; empty means genuinely empty, no invented options.

## Public pages and demo separation

Default is API mode: home, search, service, public performer and local favorites fetch actual responses. No static fallback on errors. Prices are decimal strings from the API; quote supplies commission and total. Search filters/sorting operate only on the loaded page and say so. Backend pagination preserves search parameters. Missing ratings and statistics are not fabricated. Favorites persist only browser-side in studly-api-favorites, distinct from legacy demo IDs. API lists of favorites are batched to at most 100 IDs.

The old demo can be selected explicitly at build/dev startup with NEXT_PUBLIC_STUDLY_DATA_MODE=demo and is marked in the interface. Never use this flag as a failure fallback. Categories have no API yet; API-mode category pages link to search. Orders, chats, create-service and notifications have not been integrated in this release. Their original layouts are retained in API mode with no demo data and disabled actions; their local demo behavior is available only in explicitly selected DEMO. Payments remain disabled even in DEMO.

## Verification

```sh
npx tsc --noEmit -p apps/web/tsconfig.json
npm run lint -w apps/web
npm run test -w apps/web
npm run build -w apps/web
```

Node tests substitute fetch. tests/ui-fixture.cjs is a standalone opt-in UI fixture, not an alternative Backend. It binds only 127.0.0.1:18000 with STUDLY_ALLOW_TEST_FIXTURE=1. Never use its synthetic session in production. Browser tests against it do not prove Django authorization, PostgreSQL persistence or Telegram signatures. Use an isolated copy of Frontend for fixture browser checks to avoid another Next dev lock.

Before release validate signed Telegram login, Django cookies/CSRF, registration save/reload/complete, avatar multipart/delete/read, empty specialization list, validation errors, expired sessions and duplicate clicks against the real server.
