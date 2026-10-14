# Unified News Synchronization P0

## Root causes

- The newsroom login and role checks were embedded in `index.html`, including shared demo passwords.
- CMS articles, workflow history and uploaded image data were stored in browser `localStorage`; another browser, the PWA and the Android TWA could not see those changes.
- Image files were represented by browser-only `blob:` or large `data:` URLs rather than durable server assets.
- The service worker generic GET strategy could cache authenticated CMS responses.
- Public articles had no explicit revision field for publication/edit synchronization.

## Architecture

`CMS -> role-secured CMS API -> PostgreSQL articles/workflow + Netlify Blobs media -> public News API -> website/PWA/Android TWA`

PostgreSQL remains canonical for article state. Netlify Blobs stores media bytes, while `media_assets` records ownership, rights metadata, approval and article association. The existing public News API reads only `published` PostgreSQL records.

## Environment variables

- `CMS_SESSION_SECRET`: random secret of at least 32 bytes.
- `CMS_ADMIN_EMAIL`, `CMS_ADMIN_PASSWORD`
- `CMS_REPORTER_EMAIL`, `CMS_REPORTER_PASSWORD`
- `CMS_REVIEWER_EMAIL`, `CMS_REVIEWER_PASSWORD`
- Existing database, ingestion, GNews and health variables remain unchanged.

## Migration and review deployment

1. Create a database branch/preview context.
2. Apply `20261014120000_unified_cms_media` with the direct database connection through the existing Netlify migration workflow.
3. Configure the seven CMS variables in the review context.
4. Deploy this branch as a Netlify review deploy. Do not promote it to production yet.
5. Verify reporter save/submit, reviewer approval, admin publish/edit/unpublish, exact uploaded image, and public API refresh from a second browser.

## Rollback

Revert the branch deploy. The migration is additive and preserves existing article rows. Do not drop `media_assets` until any uploaded blobs and article references have been exported or detached.