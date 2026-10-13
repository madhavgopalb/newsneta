# Production Issue Register

| Issue ID | Date | Environment | Severity | Component | Root cause | Fix | Regression test | Release | Status |
|---|---|---|---|---|---|---|---|---|---|
| P0-001 | 2026-10-13 | Production | P0 | Ingestion/Refresh | No scheduled persistent ingestion; per-visitor polling and one coarse timer | Scheduled locked ingestion, DB-first API, visibility-aware polling | Category alias, freshness API and browser checks | v82 | Validation |
| P0-002 | 2026-10-13 | Production | P0 | Media | Archive fallback could be selected without same-article ownership | Canonical same-article media resolver; missing/broken media is text-only | RSS with/without media, placeholder rejection, stable media identity | v82 | Validation |
| P0-003 | 2026-10-13 | Production | P0 | Service Worker | Historical response-consumption/cache-key defects | Network-first API, clone-before-cache, v82 cache cleanup | Static service-worker lifecycle/cache-key test | v82 | Validation |
| P1-004 | 2026-10-13 | Production | P1 | CMS/Storage | CMS and uploads are browser-local and not cross-device durable | Requires authenticated CMS API and licensed object storage integration | Not yet available | Future | Open |
