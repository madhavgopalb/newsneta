# NewsNeta Desktop Browser Audit - 2026-11-24

## Release scope

- Branch: `fix/desktop-admin-grid-p0`
- Commit under test: `694fca4`
- Preview: `https://desktop-admin-grid-p0--newsneta-telugu-news.netlify.app`
- Production was not changed by this audit.

## Issue register

| ID | Page | Browser/device | Severity | Root cause | Files changed | Fix | Verification | Remaining limitation |
| --- | --- | --- | --- | --- | --- | --- | --- | --- |
| NN-DA-001 | Authenticated NewsNeta Studio | Chromium, 1280 x 720 desktop | P0 | `.login-modal header` matched the nested `.cms-mobile-header`. Its higher specificity overrode the desktop hidden rule, inserted the mobile header as a grid item, moved the sidebar to column two, and moved the workspace below it. | `index.html`, `tests/studio-workflow.test.js` | Scoped login chrome to `.login-modal>header`; bounded `#roleDashboardContent`; added a single `minmax(0,1fr)` desktop grid row; explicitly assigned sidebar to column 1/row 1 and workspace to column 2/row 1; explicitly hid mobile-only Studio controls at 1024px and above. | Confirmed by production computed styles before the fix and 18 focused tests plus 118 full regression tests after the fix. Preview HTML contains every corrected selector and all public entry routes return 200. | Authenticated after-screenshot on the isolated preview is blocked by NN-ENV-001. |
| NN-ENV-001 | Preview CMS login | Netlify branch deploy | Release blocker for authenticated visual QA, not a production UI defect | The isolated branch deploy does not have the production CMS database binding, so login returns `CMS request failed`. | None | No insecure workaround applied. Production credentials, permissions, and database configuration were left unchanged. | Reproduced in the browser against deploy `6b055386b03ae6f8d8f43090`; production login was successful during the before measurement. | A database-bound review context is required for authenticated Admin, Reporter, and Reviewer screenshot comparison before production promotion. |

## Confirmed production defect evidence

Authenticated production measurement at 1280 x 720 before the fix:

| Element | Display/placement | Bounding box |
| --- | --- | --- |
| Mobile Studio header | Visible (`display:flex`) instead of hidden | x 17, y 17, width 240, height 824.78 |
| Sidebar | Auto grid placement in the second column | x 257, y 17, width 1006, height 824.78 |
| Workspace | Auto grid placement in a new row | x 17, y 841.78, width 240, height 919.42 |
| Shell | Expanded beyond the 688px modal | width 1246, height 1744.20 |

The browser reported no geometric sidebar/workspace overlap because the workspace had been displaced into a separate row; the result was nevertheless unusable because the workspace was below the visible modal and only 240px wide.

## Automated verification

- Focused Studio, CMS publishing, and authentication tests: 18 passed, 0 failed.
- Full repository test suite: 118 passed, 0 failed.
- JavaScript syntax check: passed.
- `git diff --check`: passed.
- Regression assertions verify:
  - no broad `.login-modal header` rule remains;
  - the direct login header selector is used;
  - mobile Studio chrome is hidden on desktop;
  - the desktop shell uses a bounded row;
  - the sidebar owns column 1/row 1;
  - the workspace owns column 2/row 1;
  - both panes have independent vertical scrolling and no horizontal overflow;
  - the mobile drawer rules and body unlock remain present;
  - the growing article editor and reachable action controls remain present;
  - existing publishing, media, authorization, revision, and service-worker tests still pass.

## Preview smoke verification

| Check | Result |
| --- | --- |
| Homepage | HTTP 200 |
| `/telangana` | HTTP 200 |
| `/andhra-pradesh` | HTTP 200 |
| `/sw.js` | HTTP 200, `application/javascript; charset=UTF-8` |
| Corrected desktop selectors deployed | Confirmed |
| Public homepage current headlines rendered | Confirmed in Chromium |
| Desktop horizontal document overflow | Not present at 1280px |

## Untested or partially tested areas

- Firefox and WebKit automation were not available in this workspace.
- No physical iPhone, iPad, Android TWA, or Android Desktop Site device was attached. Static responsive assertions cover the existing breakpoint behavior but are not represented as physical-device testing.
- Authenticated Admin, Reporter, and Reviewer navigation on the preview remains blocked by NN-ENV-001.
- Before evidence was captured in the production browser. An authenticated after screenshot cannot be truthfully produced until the preview has a safe database binding.

## Release recommendation

Do not promote this branch solely on source inspection. The code and automated gates pass, but release approval should follow one authenticated visual check in a database-bound preview or equivalent staging context at 1024, 1280, 1366, 1440, and 1920 widths. Production deployment remains intentionally unchanged.
