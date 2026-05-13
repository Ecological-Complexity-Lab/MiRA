# Useful commands

Quick reference for terminal commands I use often. All commands are in fenced code blocks so they can be copied with the hover button (or triple-click + ⌘C).

---

## Run MiRA locally

Serve over HTTP from the `MiRA/` directory (ES modules won't load via `file://`). Open http://localhost:8000 after starting.

```bash
python3 -m http.server 8000
```

Stop the server with `Ctrl+C` in the same terminal.

---

## Tests

Run the full Vitest unit suite once:

```bash
npm test
```

Re-run on file changes (watch mode):

```bash
npm run test:watch
```

Only the data-parser + calculations tests (fast subset):

```bash
npm run test:calc
```

Playwright browser tests (app must be served first — see above):

```bash
npm run test:browser
```

---

## Sync MiRA into the EMLN R package

Copies the whitelisted MiRA files into `../emln/inst/MiRA/` so `plot_multilayer()` ships the latest version.

```bash
npm run sync:emln
```

---

## Git — most-used flow

Status (with untracked files, but not the noisy `-uall`):

```bash
git status
```

Staged + unstaged diff:

```bash
git diff
```

Last 10 commits, one line each:

```bash
git log --oneline -10
```

Stage everything I just changed:

```bash
git add -A
```

Commit with a message (replace the text inside the quotes):

```bash
git commit -m "your message here"
```

Push the current branch:

```bash
git push
```

Pull with rebase (cleaner history than merge):

```bash
git pull --rebase
```

---

## Branches

List local branches (current marked with `*`):

```bash
git branch
```

Switch to an existing branch:

```bash
git switch branch-name
```

Create and switch to a new branch:

```bash
git switch -c new-branch-name
```

Delete a merged local branch:

```bash
git branch -d branch-name
```

---

## GitHub CLI

Open the repo in the browser:

```bash
gh repo view --web
```

List open issues:

```bash
gh issue list
```

Create a PR from the current branch (interactive):

```bash
gh pr create --web
```

Check PR status / CI:

```bash
gh pr status
```

---

## EMLN package (from `../emln/`)

Rebuild Rd man pages from roxygen comments:

```r
devtools::document()
```

Run R CMD check:

```r
devtools::check()
```

Install the local source build into your R library:

```r
devtools::install()
```

---

## Macros / one-liners

Kill whatever is hogging port 8000:

```bash
lsof -ti:8000 | xargs kill -9
```

Open the current directory in Finder:

```bash
open .
```

Copy the absolute path of the current directory to the clipboard:

```bash
pwd | tr -d '\n' | pbcopy
```
