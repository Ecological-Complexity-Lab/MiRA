# MiRA release strategy — branching, workflow, and CI

> **DEV-ONLY.** This file is in the dev-only list and is **not shipped on `main`**. It lives only on the `development` branch (and on disk for whoever is reading it locally). See the **Dev-only file list** section below.

This document captures the plan agreed on 2026-05-13 for taking MiRA from a private dev repo to a public release **without losing the development artifacts** (planning notes, attempt summaries, internal references, raw data sources, design assets, etc.), plus the workflow and CI conventions that follow from that plan. It is intended as a reference for Shai and any students continuing the project — read end-to-end once before changing the branching or CI setup.

---

## Goal

- **`main`** = clean, public-facing repo. Contains only what a user or contributor needs to run, test, and contribute to MiRA. First impression on GitHub is the README + a tidy file tree.
- **`development`** = long-term home for everything else. All historical dev artifacts plus any future planning notes, internal references, raw data sources, design files, etc.

Branches do **not** make files invisible — anyone visiting the public repo can switch branches in the dropdown. They separate code, not visibility. The cleanup commit on `main` is what gives `main` its clean look.

---

## The two-branch model

```
development  (long-lived)
   │   everything, including dev artifacts
   │   ←── new planning notes, attempt summaries, internal docs go here
   │
   │
main  (long-lived, public-facing)
   │   app + tests + public docs only
   │   ←── normal user-facing development happens here
   │
```

### What lives where — three tiers

Not every "internal" file needs to be hidden. The trick is to split files into three tiers and only push the actually-sensitive ones to `development`:

**Tier 1 — Public.** The app + everything users and contributors need to run, test, and modify it. Lives on `main` and stays visible.

**Tier 2 — Internal but harmless.** Project conventions, agent instructions, dev cheat-sheets. Some open-source repos ship these on `main` (e.g. `CLAUDE.md` is becoming a standard artifact in repos that use AI tooling). For MiRA we've chosen to keep this tier empty for now and treat all internal docs as Tier 3 — the public `main` stays as lean as possible. The category remains here so a future file can be classified as Tier 2 without restructuring the doc.

**Tier 3 — Actually private.** Failed-attempt summaries, internal planning notes, raw conversion sources, design drafts, agent instructions, dev cheat-sheets, this strategy doc itself. Not embarrassing but not first-impression material either. Lives on `development` only.

| File / pattern | Tier | `main` | `development` | Purpose |
|---|---|---|---|---|
| `js/` | 1 | ✅ | ✅ | App source — ES6 modules |
| `css/` | 1 | ✅ | ✅ | App styles |
| `index.html` | 1 | ✅ | ✅ | App entry point |
| `assets/` | 1 | ✅ | ✅ | Static assets (icons, fonts) |
| `data/*.json` | 1 | ✅ | ✅ | Sample datasets shipped with the app |
| `tests/` | 1 | ✅ | ✅ | Vitest unit tests + Playwright browser tests |
| `docs/manual.html` | 1 | ✅ | ✅ | User-facing manual |
| `docs/*.png` | 1 | ✅ | ✅ | Screenshots used by the manual / README |
| `README.md` | 1 | ✅ | ✅ | Public landing page on GitHub |
| `LICENSE.md` | 1 | ✅ | ✅ | License |
| `CNAME` | 1 | ✅ | ✅ | GitHub Pages custom-domain binding (`mira.ecomplab.com`) |
| `package.json` | 1 | ✅ | ✅ | npm scripts + dev dependencies |
| `config/` | 1 | ✅ | ✅ | Test runner configs (`vitest.config.js`, `playwright.config.js`) |
| `scripts/sync-emln.sh` | 1 | ✅ | ✅ | Mirrors the web app into the `emln` R package |
| `.github/workflows/` | 1 | ✅ | ✅ | CI workflow definitions |
| *(none currently)* | 2 | ✅ | ✅ | Reserved for "internal but harmless" files; currently empty by choice |
| `CLAUDE.md` | 3 | ❌ | ✅ | Agent instructions for Claude Code |
| `.claude/` | 3 | ❌ | ✅ | Claude Code local settings (`settings.json`, `launch.json`) — personal paths and permission allowlists |
| `docs/useful-commands.md` | 3 | ❌ | ✅ | Dev cheat-sheet |
| `attempt_summary_*.md` | 3 | ❌ | ✅ | Post-mortem notes from failed attempts |
| `bugs.md` | 3 | ❌ | ✅ | Internal bug-tracking notes |
| `next_step.md` | 3 | ❌ | ✅ | Active planning doc |
| `dev/` | 3 | ❌ | ✅ | General dev scratch directory |
| `_archive/` | 3 | ❌ | ✅ | Legacy files (flagged as ignore-able in CLAUDE.md) |
| `test-results/` | 3 | ❌ | ✅ | Playwright test artifacts |
| `*.tgz` | 3 | ❌ | ✅ | Downloaded tarballs (e.g. `hugeicons-react-0.4.0.tgz`) |
| `data/process/` | 3 | ❌ | ✅ | Raw data conversion sources |
| `logos/` | 3 | ❌ | ✅ | Design assets / drafts |
| `docs/calculations.md` | 3 | ❌ | ✅ | Internal math / algorithm notes |
| `docs/icons.md` | 3 | ❌ | ✅ | Internal icon catalog |
| `docs/visualization_guidelines.md` | 3 | ❌ | ✅ | Internal design guidelines |
| `docs/branching-strategy.md` | 3 | ❌ | ✅ | This doc |

**Friction trade-off.** With Tier 2 empty, any edit to `CLAUDE.md` or `docs/useful-commands.md` requires switching to `development` (or using a worktree — see Option B below). That's the cost of a maximally lean `main`. If the friction starts to bite, the escape valve is to reclassify a specific file as Tier 2 — move it back to `main`, update the dev-only list and the cleanup script, and the daily loop for that file becomes branch-switch-free again.

---

## Initial cutover (one-time)

Done from `main` at the chosen release commit:

```bash
# 1. Snapshot insurance — tag the pre-cleanup tip
git tag pre-public-cleanup
git push origin pre-public-cleanup

# 2. Create the long-lived development branch from current main
git switch -c development
git push -u origin development

# 3. Back to main and remove the dev-only files in a single commit
git switch main
git rm -r <every path in the dev-only list>
git commit -m "chore: remove dev-only files from main (kept on development)"
git push

# 4. CRITICAL — absorb main's cleanup commit into development without applying it.
# Without this, every future `git merge main` from development would replay the
# deletions and wipe the dev files. The -s ours strategy records the merge
# (so git knows development has "seen" main's cleanup) but keeps development's
# tree exactly as-is.
git switch development
git merge -s ours main -m "merge: absorb main cleanup without applying deletions"
git push
git switch main
```

After this, `main` is the lean public repo, `development` has the full state, and the two are linked by a "neutral" merge commit on `development`. `pre-public-cleanup` tag is the same SHA the snapshot was taken from — a permanent "before" pointer.

**Why step 4 is non-optional:** a plain `git merge main` from `development` will replay every commit on `main` that `development` hasn't seen — including the deletion commit from step 3. That would delete `CLAUDE.md`, `data/process/`, `logos/`, etc. from `development`. The `-s ours` merge makes git treat the cleanup as "already incorporated" so future merges only carry new app changes across.

---

## Ongoing workflow

### Day-to-day app work

Happens on **`main`** (or feature branches off `main`). This is the live app. Normal commits, normal PRs.

#### Why not "work on `development`, PR to `main`"?

The intuitive alternative is to treat `development` as the integration branch and PR `development → main` periodically. It feels neater (one working branch, review gate before release) but has structural problems for this repo:

1. **A PR merges whatever's on the branch.** It cannot selectively exclude files. So every `development → main` PR has two options:
   - **Include the dev files** — `main` is no longer clean, just delayed-clean.
   - **Strip them first** — either curate each PR by hand (cherry-pick only the app commits) or do all app work on feature branches off `main` and never commit app changes to `development`. The latter is exactly what the current model already does, just with extra ceremony.
2. **The PR diff publicly lists dev-only files.** Even files you don't merge appear in the "Files changed" tab of the PR. The whole point of a lean `main` is the first impression — visible PRs would undermine that.
3. **Two switches per dev artifact, not one.** With `development → main` PRs you still end up switching branches when writing notes; you just also have to open and merge a PR every time you want a public change to ship.

When the inverted model **does** make sense:
- A team with mandatory code review before anything hits the public branch.
- CI that must run on every merge candidate before it touches `main`.
- A high ratio of dev-only commits to public commits (most work is internal).

For solo work or a small student team on MiRA, the simpler model (work on `main`, switch to `development` only to drop a note) is one switch instead of N PR cycles, and dev files never need to be filtered out of anything because they're never on `main` in the first place.

### When you write a Tier-3 artifact

Tier-3 files (attempt summaries, planning notes, raw data conversion scripts, etc.) live on `development` only. Two ways to write them without disrupting your app work:

**Option A — branch switch.** Single-folder workflow, one extra command:

```bash
git switch development
git pull origin main          # keep dev caught up with app changes
# write the note, commit
git push
git switch main               # back to normal app work
```

**Option B — worktree.** Two-folder workflow, zero switching. See the next section.

### Option B in detail — git worktree + VS Code multi-root workspace

A **git worktree** is a second working folder backed by the same `.git` repository. The two folders share all commits, branches, and remotes, but each one has its own working tree checked out to a different branch. This means you can have `main` checked out in `MiRA/` and `development` checked out in a sibling folder `MiRA-dev/` simultaneously — no `git switch` ever, no stashing, no risk of mixing up which branch you're committing to.

#### One-time setup

From the existing `MiRA/` folder (currently on `main`):

```bash
cd /Users/shai/GitHub/ecomplab/MiRA
git worktree add ../MiRA-dev development
```

That creates a new folder `../MiRA-dev/` with the full `development` tree checked out. Both folders point at the same `.git` (the original — the new folder gets a small `.git` *file* that links back to it). `git worktree list` from either folder shows both.

#### VS Code multi-root workspace

Open both folders in a single VS Code window so you can edit either tree without switching windows:

1. In VS Code, **File → Add Folder to Workspace…** → pick `MiRA-dev/`.
2. **File → Save Workspace As…** → save as `MiRA.code-workspace` somewhere outside both folders (e.g. `~/GitHub/ecomplab/MiRA.code-workspace`). Saving it inside `MiRA/` would either ship it to `main` or require adding it to the dev-only list — keeping it one level up avoids both.
3. Re-open via that workspace file from then on.

The Source Control panel will show both folders as separate sources, each with its own branch indicator in the status bar — so you can see at a glance which folder is on `main` and which is on `development`. The integrated terminal lets you pick which folder its `cwd` is, so `git` commands always run against the intended worktree.

#### Daily use

- App work → edit in `MiRA/`, commit, push. Branch stays on `main`.
- Tier-3 artifact (planning note, attempt summary, etc.) → edit in `MiRA-dev/`, commit, push. Branch stays on `development`.
- No `git switch` in either folder, ever.

#### Syncing `development` with `main` from the worktree

Same rule as Option A, just no switching:

```bash
cd ../MiRA-dev
git merge main
git push
```

(The merge brings `main`'s new commits into `development`. See **Keeping `development` synced with `main`** below for the absorption rules.)

#### Caveats

- **One branch per worktree.** Git refuses to check out the same branch in two worktrees. If you ever want `development` checked out in the main folder temporarily, you have to remove or move the dev worktree first.
- **The `.git` folder is shared.** A `git gc` or `git fetch` in either folder affects both. Don't `rm -rf` either folder casually — use `git worktree remove` so git unlinks it cleanly.
- **Hooks, configs, and the staging area are per-worktree.** That's usually what you want; just be aware that a hook installed in `MiRA/` may not be active in `MiRA-dev/` unless installed there too.

#### Removing the worktree

When you're done (or want to redo it elsewhere):

```bash
git worktree remove ../MiRA-dev
```

That deletes the folder and unregisters it. The `development` branch and all its commits remain in the main `.git` — only the second working copy is removed.

### Keeping `development` synced with `main`

Once the cutover's `-s ours` absorption is in place (step 4 above), regular merges work. Run periodically (or before adding a new dev note that references current app code):

```bash
git switch development
git merge main                 # bring in latest app changes
git push
git switch main
```

The merge brings over only the commits on `main` that aren't yet reachable from `development`. Because the absorption commit recorded the cleanup as "already seen," only genuine app changes get applied — dev files stay put.

**Only merge `main → development`, never the reverse.** That keeps dev artifacts from leaking back into the public branch. (Practically: `git merge development` from `main` would replay every dev-artifact commit, recreating `CLAUDE.md` etc. on `main` — and a force-push to clean it up afterwards would break anyone who'd pulled.)

#### If you ever need a second cleanup commit on `main`

Say you later decide an additional file is dev-only and want to remove it from `main`. The new cleanup commit on `main` is itself a deletion — so you need another absorption on `development`:

```bash
# On main: remove the file
git switch main
git rm path/to/new-dev-only-file
git commit -m "chore: remove additional dev-only file"
git push

# On development: absorb the new cleanup
git switch development
git merge -s ours main -m "merge: absorb additional cleanup"
git push
git switch main
```

In practice you can sidestep this entirely by **creating new dev-only files on `development` from the start**, so they never live on `main` and never need a cleanup commit there.

#### Alternative: cherry-pick instead of merge

If you forget the `-s ours` absorption, or want to bring over just one specific commit without merging everything, cherry-pick works:

```bash
git switch development
git cherry-pick <main-commit-sha>
git push
```

Cherry-picking applies a single commit's diff without considering merge history, so the cleanup commit is never replayed. Cleaner for one-off syncs; clunkier for bulk catch-up.

---

## Removing `development` later

If you ever want to retire the branch:

```bash
# 1. Tag the tip first so the snapshot is preserved even after the branch is gone
git tag dev-archive-$(date +%Y-%m-%d) development
git push origin dev-archive-$(date +%Y-%m-%d)

# 2. Delete the branch on the remote and locally
git push origin --delete development
git branch -D development
```

The tag is an immutable pointer to that commit — files stay reachable via `git checkout <tag>` forever. The branch is gone from the dropdown so the public repo looks single-branch.

**What you'd lose without a tag:** every commit reachable only from `development` becomes unreferenced and eventually garbage-collected. So always tag before deleting.

---

## CI / GitHub Actions

**Status (2026-05-13):** no GitHub Actions configured yet (`.github/workflows/` does not exist). The sections below are the recommended setup for when CI is added.

CI configuration lives **on `main`** in `.github/workflows/*.yml`. Each workflow file declares which branches and events trigger it via the `on:` block. This has two practical implications for the two-branch model:

1. **CI only sees what's on the branch it's running against.** A workflow on `main` runs against `main`'s file tree — it won't find `data/process/`, `dev/`, or any other dev-only path. Workflows that rely on dev-only inputs will fail. Either keep those inputs out of CI scope, or move the inputs to `main` (and update the dev-only list).
2. **CI doesn't automatically run on `development`** unless you list it in `on.push.branches`. Decide explicitly whether you want it to.

### Recommended workflows

Three lightweight workflows cover MiRA's needs:

#### 1. Unit tests on every PR and push to `main`

```yaml
# .github/workflows/test.yml
name: tests
on:
  push:
    branches: [main]
  pull_request:
    branches: [main]
jobs:
  vitest:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with:
          node-version: '20'
          cache: 'npm'
      - run: npm ci
      - run: npm test
```

Fast (≈30 s), no browser dependency, gates the most important regression class.

#### 2. Playwright browser tests (optional, slower)

Browser tests are heavier — install Chromium, serve the app, etc. Worth running on PRs to `main` but **not** on every push:

```yaml
# .github/workflows/browser-tests.yml
name: browser tests
on:
  pull_request:
    branches: [main]
jobs:
  playwright:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with:
          node-version: '20'
          cache: 'npm'
      - run: npm ci
      - run: npx playwright install --with-deps chromium
      - run: npm run test:browser
```

#### 3. GitHub Pages deploy

MiRA is hosted at [mira.ecomplab.com](https://mira.ecomplab.com/) via GitHub Pages. Two options:

- **Branch-based (current default in the upstream `yuvalbloch/multilayer_viz_test` remote):** Pages serves the root of `main`. No workflow needed — every push to `main` updates the live site within a minute. The `CNAME` file is what binds the custom domain.
- **Actions-based:** Use [`actions/deploy-pages`](https://github.com/actions/deploy-pages) for full control (e.g. run a build step first, deploy only on tags, deploy a subdirectory).

For MiRA's "build = no build, just static files" reality, branch-based is simpler and is what's already wired up. Only switch to Actions-based if you start needing a build step.

### Branch protection (recommended once CI is wired)

In **Settings → Branches → Branch protection rules**, add a rule for `main`:

- ☑ Require status checks to pass before merging — select `tests` (and `browser tests` if you've enabled it on PRs).
- ☑ Require pull request reviews before merging (set required approvers based on team size).
- ☑ Restrict who can push to matching branches (optional but recommended once collaborators join).
- ☐ Do **not** require linear history if you intend to merge `main → development` periodically — that creates merge commits, which is fine.

No protection rule on `development`. It is a workspace; freedom matters more than gates.

### CI implications of the two-branch model

- Workflows scoped to `main` won't run on `development` pushes. If you want a "lint dev notes" or "spell-check planning docs" check, add a separate workflow that lists `development` in `on.push.branches` — but keep its scope narrow (e.g. `paths: ['*.md', 'docs/**']`) so it doesn't try to test app code that hasn't been integrated yet.
- The cleanup commit on `main` will be a status-check event. Verify CI is green on that commit before announcing the public release.
- If you add a workflow that needs a secret (API token, deploy key), store it as a GitHub Actions secret in **Settings → Secrets and variables → Actions**. Never commit it to either branch.

---

## Issues (and PRs)

GitHub Issues are **repo-level, not branch-level.** Switching, renaming, or deleting branches does not affect issue records.

- Existing issues stay. Their content and history don't change.
- Issue bodies that reference specific commit SHAs (e.g. "fixed in 1a2b3c4") still link to those commits because we did **not** rewrite history. Both the SHA and the tagged snapshot remain reachable.
- If `development` is later deleted **without** a tag, any commit-SHA references that pointed to commits only on `development` become dead links. The issues themselves are fine.

Bottom line: branch surgery is safe for issues; history rewrites are not.

---

## What we considered and didn't choose

### `git filter-repo` (history rewrite)

Strips specific files out of every commit in history. Pros: dev files become truly invisible, including in `git log`. Cons:

- Every commit gets a new SHA. External references break.
- Force-push required. Anyone with a clone has to re-clone.
- Issue bodies that mention old SHAs become dead links.
- Irreversible without restoring from backup.

**Not chosen** because: nothing in MiRA history is sensitive (no API keys, no embarrassing content). The cost (broken refs, irreversibility) outweighs the benefit (slightly cleaner `git log`). Light cleanup on `main` is enough.

### Separate private repo for dev artifacts

Move dev files into a completely separate private GitHub repo. Pros: truly private. Cons: friction to add a note (clone two repos, two `git push`es).

**Not chosen** because: dev artifacts being visible on a public branch is acceptable for MiRA. If that ever changes, this is the migration path.

### `.gitignore` the dev files

Keep them on disk only, not tracked. Pros: simplest. Cons: lose them when switching computers, no version history, no backup.

**Not chosen** because: we want history and remote backup for the dev artifacts.

---

## Pre-flight checklist (before flipping the repo to public)

- [ ] All current MiRA work committed to `main`
- [ ] `pre-public-cleanup` tag created and pushed
- [ ] `development` branch created and pushed (verify it contains the dev files)
- [ ] Cleanup commit pushed to `main` (verify the dev files are gone via `gh repo view`)
- [ ] `-s ours` absorption merge pushed to `development` (verify with `git log --merges -1 development` — should show the absorb commit; verify dev files still present on the branch)
- [ ] Grep history for accidental secrets: `git log -p | grep -i -E 'api[_-]key|password|secret|token|\.env'`
- [ ] No shipped file (README, index.html, manual.html, etc.) links to a removed path — run `grep -rn -F` for each removed path across the surviving files
- [ ] Tests still green on `main`: `npm test`
- [ ] App still loads on `main`: `python3 -m http.server 8000` → smoke-test
- [ ] EMLN sync still works on `main`: `npm run sync:emln` should succeed against the trimmed tree
- [ ] Default branch on GitHub is `main` (Settings → Branches)
- [ ] If CI workflows have been added: every workflow has `branches: [main]` (and optionally `development`) in its `on:` block, and the last run on `main` is green
- [ ] Branch protection on `main` is configured (status checks required, optional review gate) — see **CI / GitHub Actions** section

---

## Dev-only file list (current — Tier 3)

Anything in this list lives on `development` only and is removed from `main` in the cutover commit. This is the **Tier 3** list from the "What lives where" table above — Tier 1 files stay on `main` and don't appear here; Tier 2 is currently empty.

- `CLAUDE.md`
- `.claude/` (Claude Code settings; personal paths, not portable)
- `docs/useful-commands.md`
- `attempt_summary_*.md` (any file matching this glob)
- `bugs.md`, `next_step.md` (if present)
- `dev/`
- `_archive/`
- `test-results/`
- `*.tgz` (e.g. `hugeicons-react-0.4.0.tgz`)
- `data/process/`
- `logos/`
- `docs/calculations.md`
- `docs/icons.md`
- `docs/visualization_guidelines.md`
- `docs/branching-strategy.md` ← this file

Update this section whenever a new dev-only artifact is created. Then propagate it to whatever script automates the cleanup (if one exists). If you're unsure whether a new file is Tier 2 or Tier 3, ask: *would I be comfortable with a stranger reading this in five years?* If yes → Tier 2 (`main`). If no → Tier 3 (`development`).
