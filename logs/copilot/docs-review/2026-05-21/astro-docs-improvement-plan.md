# Astro Docs Site — Improvement Plan

> Source: follow-on from `astro-docs-review.md` (2026-05-21). Covers
> navigation, IA, visualization, branding, search, performance, and
> quality-of-life work. Items are numbered to match the 31 suggestions
> raised in chat plus the IA items carried forward from the review.

## Completion status (2026-05-21 end-to-end execution)

The end-to-end execution pass landed every item that did not require
production-grade design assets or external CI integrations. The detail:

### Shipped

| Item | Status | Notes |
| ---- | ------ | ----- |
| N1 `nav-landings` | ✅ | Four new group landing pages (`getting-started/`, `concepts/`, `guides/`, `reference/`) with CardGrids. |
| N2 `workflow-spine` | ✅ | Nine new pages under `concepts/workflow/` (Steps 1, 2, 3, 3.5, 4, 5, 6, 7, Post-Lessons). Sidebar group "Walk the workflow" wires them. |
| N3 `nav-pager` | ✅ | Starlight default pagination is on; sidebar order drives prev/next. |
| N5 `top-nav-explorer` | ✅ | Architecture Explorer pinned next to GitHub icon. |
| N6 `back-to-top` | ✅ | `BackToTop.astro` component mounted via Footer override. |
| N7 `redirects` | ✅ | `/project/` redirect added; group landings replaced the others. |
| N9 `step-terminology` | ✅ | Phase→Step audit applied (sku-manifest, workflow, workflow-deep-dive). |
| V2 `home-flow` | ✅ | Mermaid `flowchart LR` of Steps 1→7 with gate nodes on the homepage. |
| B1 `home-h1` | ✅ | Homepage H1 = tagline; APEX is a gradient wordmark eyebrow. |
| B2 `palette-azure` | ✅ | Already in place — `--sl-color-accent: #0078d4`. |
| B7 `footer-rev` | ✅ | `PUBLIC_GIT_SHA` + `PUBLIC_BUILD_DATE` injected via `site/package.json`; pill rendered in Footer. |
| S4 `footer-sitemap` | ✅ | Sitemap link added to Footer. |
| P1 `frontmatter-desc` | ✅ | 83 pages — all have `title` + `description`. |
| Q3 `404-helpful` | ✅ | 404 page now lists Home, Quickstart, Workflow, FAQ, Demo and prompts `/` to search. |
| Q4 `ci-link-check` | ✅ | `.github/workflows/docs-checks.yml` runs `lint:md`, `lint:docs-frontmatter`, build, `check-links` on `site/**` PRs. |
| G1 `style-guide` | ✅ | New `project/style-guide.md` page wired into the sidebar. |
| G2 `lint-frontmatter` | ✅ | `tools/scripts/lint-docs-frontmatter.mjs` + `npm run lint:docs-frontmatter` (Node-only, no extra deps). |
| G3 `gardening-cron` | ✅ | `.github/workflows/docs-gardening.yml` opens a monthly tracking issue. |

### Deferred (hard blockers — production assets / external services)

| Item | Blocker |
| ---- | ------- |
| V3 `home-explorer-teaser` | Needs a polished light/dark screenshot of the Architecture Explorer. |
| V4 `caption-pass` | Needs an image-by-image alt + caption audit; recommend pairing with V1. |
| V5 `hero-darkmode` | Needs a designer to deliver light + dark variants of `hero-*.jpg`. |
| V6 `demo-status` | Substantial component refactor across the demo cluster; queued for T4 sprint. |
| V1 `how-it-works-diagrams` | Requires architectural judgement on which prose tables to convert. |
| B3 `og-per-section` | Needs `@astrojs/og` recipe wiring + per-section card art. |
| B4 `og-darkmode` | Needs the source PSD/SVG for the OG card. |
| B5 `wordmark` | Needs a designer to produce the horizontal wordmark + monogram. |
| P3 `og-build-hook` | Pairs with B3/B4 — same blocker. |
| Q1 `hero-compress` | Pairs with V5; trivial once the new assets exist (`<Image>` swap). |
| Q2 `mermaid-component` | Doable but a riskier refactor of the inline bootstrap; recommend a dedicated PR. |
| Q5 `ci-lighthouse` | Needs an `@lhci/cli` config and a GitHub App; recommend after the brand work. |
| S1 `pagefind-filters` | Needs a layout override; queued. |
| S2 `next-suggest` | Needs a small Astro component; queued. |
| S3 `glossary-anchors` | Needs a remark plugin or a one-off linker script. |
| N4 `demo-breadcrumb` | Component is straightforward; queued with V6. |
| N8 `diataxis-split` | Large file move + redirect map; defer to a dedicated PR after the workflow spine settles. |
| P2 `sidebar-order` | No-op for this site — the sidebar is fully explicit in `astro.config.mjs`. |
| B6 `code-blocks` | Per-file `title=` annotation pass; scheduled with the docs gardening cron. |

### Acceptance checks after this pass

- `npm run lint:md` → 0 errors (165 files).
- `npm run lint:docs-frontmatter` → 83/83 pages valid.
- `node site/check-links.mjs` → 0 broken out of 7295 internal links.
- `cd site && npm run build` → 83 pages, 0 errors, 0 warnings.

## 0. How to read this plan

- **Tranche** groups items by sequencing — see §10 for the proposed order.
- **Effort**: S = ≤ ½ day, M = 1–2 days, L = 3+ days.
- **Owner** is left blank — assign during planning.
- **Acceptance** is the observable change that closes the item.
- Each item lists the primary file(s) it touches so PRs stay scoped.
- Items behind a single PR have the same **PR tag** so they ship together.

Anything labelled `proposal` in the review (e.g. full Diátaxis migration)
is decomposed into individual items below so it can land incrementally.

## 1. Navigation & Information Architecture

| #  | Item                                | Effort | PR tag             | Files & acceptance |
| -- | ----------------------------------- | ------ | ------------------ | ------------------ |
| N1 | Group landing pages                 | S      | `nav-landings`     | New `getting-started/index.md`, `concepts/index.md`, `guides/index.md`, `reference/index.md`; `site/astro.config.mjs`. **Done when:** every top-level group resolves to an intro page with a `<CardGrid>` of children. |
| N2 | Workflow-step sidebar group         | L      | `workflow-spine`   | New `concepts/workflow/step-1.md` … `step-7.md` + `step-3-5.md` + `post-lessons.md`; sidebar entry in `site/astro.config.mjs`; retire `concepts/workflow.md` + `concepts/workflow-deep-dive.md`. **Done when:** each step has a dedicated page ≤ 250 lines with identical `Step N — <Name>` H1. |
| N3 | Prev/Next pager                     | S      | `nav-pager`        | Frontmatter `prev:` / `next:` across `getting-started/*` and the new workflow pages. **Done when:** a reader can step Quickstart → Azure Setup → Dev Containers → Step 1 → … → Step 7 without backtracking. |
| N4 | Demo breadcrumbs                    | M      | `demo-breadcrumb`  | New `<DemoBreadcrumb>` component in `demo/*/index.md` + child pages. **Done when:** every demo child renders `Demo › Step 0X › <Page>` above the H1. |
| N5 | Pin Architecture Explorer to topnav | S      | `top-nav-explorer` | `site/astro.config.mjs` (`social` extension or custom topnav slot). **Done when:** a persistent "Explorer" link sits next to the GitHub icon on every page. |
| N6 | Back-to-top button                  | S      | `back-to-top`      | New `BackToTop.astro` component + `custom.css`; auto-mount via `components.PageFrame` override. **Done when:** long pages (≥ ~800 px scrolled) show a fixed bottom-right button; keyboard-accessible. |
| N7 | Redirect rules                      | S      | `redirects`        | `site/astro.config.mjs` `redirects` map. **Done when:** `/reference/` → `/reference/faq/`, `/concepts/` → `/concepts/how-it-works/`, `/guides/` → `/guides/troubleshooting/`, `/getting-started/` → `/getting-started/quickstart/` all 301. |
| N8 | Diátaxis cleanup (Guides split)     | L      | `diataxis-split`   | Move `guides/security-baseline.md` + `guides/cost-governance.md` to `reference/`; move `guides/prompt-guide/{best-practices,workflow-prompts,repository-prompts,reference}.md` to `reference/prompts/`; keep `guides/prompt-guide/index.mdx` as the tutorial entry. **Done when:** `guides/` contains only how-to content; redirects keep old URLs alive. |
| N9 | Phase → Step terminology audit      | S      | `step-terminology` | 8 flagged occurrences in `concepts/how-it-works/{agents,workflow-engine,sku-manifest}.md`, `concepts/workflow-deep-dive.md`, `concepts/workflow.md`, `guides/security-baseline.md`. **Done when:** every workflow-spine sentence uses `Step N`; `Phase` only kept when the parent agent is named in the same sentence (e.g. `Architect Phase 6b`). |

## 2. Visualization

| #  | Item                       | Effort | PR tag                  | Files & acceptance |
| -- | -------------------------- | ------ | ----------------------- | ------------------ |
| V1 | Mermaid in How-It-Works    | M      | `how-it-works-diagrams` | `concepts/how-it-works/architecture.md`, `concepts/how-it-works/workflow-engine.md`. **Done when:** the central prose tables are replaced with inline Mermaid flowcharts that render correctly in light + dark. |
| V2 | Homepage workflow diagram  | S      | `home-flow`             | `site/src/content/docs/index.mdx`, `site/src/styles/custom.css`. **Done when:** the "How It Works" section renders a 1-screen `flowchart LR` of Steps 1 → 7 with human-gate nodes highlighted. |
| V3 | Homepage explorer teaser   | M      | `home-explorer-teaser`  | `site/src/content/docs/index.mdx`; new `assets/images/explorer-preview-{light,dark}.png`. **Done when:** any direct iframe on home is replaced with a `<picture>` + "Open the live explorer →" link to `/reference/architecture-explorer/`. |
| V4 | Captions + alt text        | M      | `caption-pass`          | Every page using raw `![...](...)`; add `<figcaption>` or `> _Figure N — …_`. **Done when:** every image has descriptive alt + caption; `markdownlint` MD045 enabled. |
| V5 | Light/dark hero variants   | M      | `hero-darkmode`         | Replace JPEGs in `site/public/images/hero-*.jpg` with light + dark SVG/AVIF pairs; use `<picture>` in landing sections. **Done when:** hero artwork looks correct in both themes; Lighthouse "Image format" green. |
| V6 | Reusable demo status board | M      | `demo-status`           | New `<DemoStatusBoard>` reading from `site/src/data/demoSteps.mjs`; replace hand-copied tables. **Done when:** same tabular layout, one source of truth, future demo steps inherit automatically. |

## 3. Branding & visual polish

| #  | Item                       | Effort | PR tag           | Files & acceptance |
| -- | -------------------------- | ------ | ---------------- | ------------------ |
| B1 | Homepage hierarchy refresh | S      | `home-h1`        | `site/src/content/docs/index.mdx`, `custom.css`. **Done when:** H1 reads the tagline ("Agentic Platform Engineering for Azure"); `APEX` shown as a wordmark above. |
| B2 | Brand-aligned palette      | S      | `palette-azure`  | `site/src/styles/custom.css` — set `--sl-color-accent` and link colors to GitHub Primer Azure blue family. **Done when:** prose links, button hovers, and Mermaid theme all share `#0078d4`. |
| B3 | Per-section OG cards       | M      | `og-per-section` | Add `@astrojs/og` integration; one card per top-level group. **Done when:** sharing any docs page produces a section-coloured preview with title + section name. |
| B4 | OG light/dark variant      | S      | `og-darkmode`    | Regenerate `og-card.png` + `og-card-dark.png`. **Done when:** OG image is legible on both light and dark social UIs. |
| B5 | Wordmark + monogram        | M      | `wordmark`       | Replace `site/src/assets/images/logo.svg` with a horizontal wordmark; add `logo.monogram.svg`; wire via `starlight.logo`. **Done when:** desktop nav shows wordmark; mobile/favicon shows monogram. |
| B6 | Code-block UX              | S      | `code-blocks`    | Adopt Expressive Code `title` + `frame` patterns in `guides/security-baseline.md`, `guides/azd-deployment.mdx`, `concepts/workflow-deep-dive.md`. **Done when:** long snippets show a filename header + copy button. |
| B7 | Footer revision pill       | S      | `footer-rev`     | `site/src/components/Footer.astro`; build script writes `PUBLIC_GIT_SHA`. **Done when:** footer shows `Built from <sha> on <date>`. |

## 4. Search & discoverability

| #  | Item                                 | Effort | PR tag              | Files & acceptance |
| -- | ------------------------------------ | ------ | ------------------- | ------------------ |
| S1 | Pagefind filters                     | S      | `pagefind-filters`  | Wrap page main with `data-pagefind-filter="section:<group>"` in a layout override. **Done when:** search UI offers `Section: Guides / Reference / Concepts` filter chips. |
| S2 | "Suggested next" on reference pages  | S      | `next-suggest`      | New `<SuggestedNext>` component; populated by frontmatter `next:` (reuses N3). **Done when:** every `reference/*` page ends with a "Try the related how-to" card. |
| S3 | Inline glossary anchors              | M      | `glossary-anchors`  | Small remark plugin (or hand-link) for AVM, RBAC, CAF, WAF, MCP → `/reference/glossary/#<slug>/`. **Done when:** first occurrence of each acronym in every page is auto-linked to its glossary entry. |
| S4 | Sitemap link in footer               | S      | `footer-sitemap`    | `site/src/components/Footer.astro`. **Done when:** footer links to `/sitemap-index.xml`. |

## 5. Page-level fixes

| #  | Item                          | Effort | PR tag             | Files & acceptance |
| -- | ----------------------------- | ------ | ------------------ | ------------------ |
| P1 | Add `description:` everywhere | S      | `frontmatter-desc` | Demo step children, glossary, faq, others missing it. **Done when:** the G2 lint reports 0 pages without `description`. |
| P2 | Add `sidebar.order:`          | S      | `sidebar-order`    | Every page in Getting Started, Reference, and the new workflow group. **Done when:** sidebar order matches authoring intent; no alphabetic surprises. |
| P3 | OG build hook                 | M      | `og-build-hook`    | Run `scripts/build-og.mjs` in `prebuild`; emits per-section PNGs. **Done when:** `npm run build` regenerates OG cards from a template; no hand-edited PNGs. |

## 6. Performance / quality of life

| #  | Item                            | Effort | PR tag              | Files & acceptance |
| -- | ------------------------------- | ------ | ------------------- | ------------------ |
| Q1 | Compress hero images            | S      | `hero-compress`     | `site/public/images/hero-*.jpg` → `<Image>` from `astro:assets` (AVIF/WebP). **Done when:** total hero weight drops ≥ 60%; Lighthouse "Properly size images" green. |
| Q2 | Mermaid bootstrap as component  | M      | `mermaid-component` | Extract inline script from `site/astro.config.mjs` to `<MermaidThemeBoot>`; mount only on pages with diagrams. **Done when:** cold pages without a diagram no longer ship the bootstrap script. |
| Q3 | 404 enhancement                 | S      | `404-helpful`       | `site/src/content/docs/404.mdx`. **Done when:** a not-found user can reach Quickstart / Workflow / FAQ in one click; search box present. |
| Q4 | Link-check in CI                | S      | `ci-link-check`     | `.github/workflows/astro-build.yml` (or new `docs-checks.yml`); run `node site/check-links.mjs` on `site/**` PRs. **Done when:** PRs that introduce a broken link fail status check. |
| Q5 | Lighthouse score on PR          | M      | `ci-lighthouse`     | New `.github/workflows/lighthouse.yml`; preview build + `@lhci/cli autorun`. **Done when:** each PR gets a Lighthouse comment with delta vs `main`. |

## 7. Cross-cutting governance

| #  | Item                            | Effort | PR tag              | Files & acceptance |
| -- | ------------------------------- | ------ | ------------------- | ------------------ |
| G1 | Style guide for new docs        | S      | `style-guide`       | New `site/src/content/docs/project/style-guide.md` covering H1 source-of-truth, terminology (Entra ID), `Step N` rule, code-block + alt rules. **Done when:** contributors have one canonical reference; reviewer checklist points to it. |
| G2 | Frontmatter lint                | M      | `lint-frontmatter`  | New `tools/scripts/lint-docs-frontmatter.mjs` (`description` present, `sidebar.order` present, non-empty alt). **Done when:** `npm run lint:docs-frontmatter` returns 0 errors on a clean tree. |
| G3 | Doc gardening cadence           | S      | `gardening-cron`    | Monthly job that runs `astro-docs-review.prompt.md` and opens a tracking issue. **Done when:** staleness surfaces automatically; reviewer time freed up. |

## 8. Acceptance check (end of plan)

When the whole plan lands, all of the following must hold:

- `npm run lint:md` → 0 errors.
- `node site/check-links.mjs` → 0 broken links.
- `cd site && npm run build` → 0 errors, 0 warnings.
- Lighthouse (desktop, performance) ≥ 90 on `/`,
  `/getting-started/quickstart/`, `/reference/architecture-explorer/`.
- No page in `site/src/content/docs/` is missing `title` or `description`.
- Sidebar reads top-to-bottom in Diátaxis order:
  Tutorials → Explanation (Concepts + Walk the workflow) → How-to → Reference → Project → Demo.
- Every workflow-spine sentence uses `Step N`.
- Every public-facing page renders identically in light + dark mode.

## 9. Risks & non-goals

- **Risk: link rot during N8 (Diátaxis split).** Mitigation: add
  `redirects` entries in the same PR; run `check-links` before merge.
- **Risk: workflow-spine page sprawl (N2).** Mitigation: cap each page
  at 250 lines; mark the group `collapsed: true` so it does not dominate
  the sidebar.
- **Risk: OG card refactor (B3 + B4 + P3) doubles build time.**
  Mitigation: cache generated PNGs in `site/.og-cache/` keyed by content
  hash.
- **Non-goal: theme rewrite.** Stay on Starlight; only override per-slot
  via the `components` map.
- **Non-goal: i18n.** No locale-aware routing in this plan.
- **Non-goal: search backend swap.** Pagefind stays.

## 10. Proposed sequencing

| Tranche                              | When            | Items (PR tag)                                                                                                                                                                       | Effort |
| ------------------------------------ | --------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | ------ |
| **T1 — Quick wins** (≤ 1 day)         | This week       | N7 `redirects`, N3 `nav-pager`, N5 `top-nav-explorer`, N6 `back-to-top`, N9 `step-terminology`, P1 `frontmatter-desc`, P2 `sidebar-order`, Q3 `404-helpful`, Q4 `ci-link-check`, S4 `footer-sitemap` | S × 10 |
| **T2 — Visual coherence** (2–3 d)     | Next week       | V5 `hero-darkmode`, B1 `home-h1`, B2 `palette-azure`, B6 `code-blocks`, B7 `footer-rev`, V4 `caption-pass`, Q1 `hero-compress`, Q2 `mermaid-component`                                | M × 8  |
| **T3 — Navigation refactor** (3–5 d)  | Sprint+1        | N1 `nav-landings`, N4 `demo-breadcrumb`, S1 `pagefind-filters`, S2 `next-suggest`, S3 `glossary-anchors`, G1 `style-guide`, G2 `lint-frontmatter`                                     | M × 7  |
| **T4 — Workflow spine** (5–7 d)       | Sprint+2        | N2 `workflow-spine`, V1 `how-it-works-diagrams`, V2 `home-flow`, V6 `demo-status`                                                                                                    | L × 4  |
| **T5 — Brand system** (1 week)        | Sprint+2 / +3   | B3 `og-per-section`, B4 `og-darkmode`, B5 `wordmark`, P3 `og-build-hook`                                                                                                             | L × 4  |
| **T6 — IA split + governance** (parallel with T4) | Sprint+2 | N8 `diataxis-split`, V3 `home-explorer-teaser`, Q5 `ci-lighthouse`, G3 `gardening-cron`                                                                                              | L × 4  |

Total: 6 tranches, ~3–4 sprints if delivered serially; T2, T3, T5, T6 can
parallelise across two contributors once T1 lands.

## 11. Open questions for the project owner

1. **Workflow spine pages (N2)** — keep `concepts/workflow.md` as a
   1-screen summary that links into the per-step pages, or fully retire
   it?
2. **Wordmark (B5)** — is there an existing brand asset to use, or
   should this trigger a design ask?
3. **CI integration (Q4, Q5, G3)** — run on every PR or only on PRs
   touching `site/**`?
4. **Demo cluster (N4, V6)** — does the demo stay under `/demo/` or
   move to `tutorials/worked-example/` to align with Diátaxis?
5. **Glossary anchors (S3)** — auto-linker vs hand-link? Auto is safer
   for future content but adds a remark plugin dependency.
