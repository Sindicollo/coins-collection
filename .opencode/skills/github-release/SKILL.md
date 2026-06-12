---
name: github-release
description: Use when the user asks to make a release, publish a release, create a GitHub release, bump version, or ship a new version of the app. Covers bumping version in package.json, updating CHANGELOG.md and README.md, pushing a tag to trigger GitHub Actions, and local fallback with gh CLI.
---

# GitHub Release

Create and publish a GitHub release for the coin-collection Electron app.

## Prerequisites

- `gh` CLI authenticated (`gh auth status`) — required for local fallback
- `CHANGELOG.md` entry for the new version
- All changes committed to `main`

## tl;dr

Push a tag — GitHub Actions builds macOS + Windows and creates the release:

```bash
git tag -a vX.Y.Z -m "vX.Y.Z — <description>"
git push origin vX.Y.Z
```

## Full process

### 1. Determine the version

Ask the user for the version number (e.g. `1.3.0`). If they don't specify,
check the current version in `package.json` and suggest the next semver bump.

### 2. Bump version in `package.json`

```json
"version": "1.2.0" → "version": "1.3.0"
```

### 3. Update `CHANGELOG.md`

Add a new section at the top:

```markdown
## vX.Y.Z

### Added
- ...

### Changed
- ...

### Fixed
- ...
```

Use English. Write concise, user-facing bullet points.

### 4. Update `README.md`

Update the download table — change version in all three links:

```markdown
| **macOS** (arm64) | [Download .dmg](https://github.com/Sindicollo/coins-collection/releases/download/vX.Y.Z/Coin-Collection-X.Y.Z-arm64.dmg) (~114 MB) |
| **Windows** (x64) | [Download Setup](https://github.com/Sindicollo/coins-collection/releases/download/vX.Y.Z/Coin-Collection-Setup-X.Y.Z.exe) (~91 MB) — [Portable](https://github.com/Sindicollo/coins-collection/releases/download/vX.Y.Z/Coin-Collection-X.Y.Z.exe) |
```

**Important:** electron-builder uploads with **hyphens** (`Coin-Collection`), not dots or spaces. Do not use the local `dist/` filename (which has spaces) — GitHub converts spaces to hyphens when electron-builder uploads.

> ⚠️ **Do NOT skip this step.** Without it, users will download old versions from the README links. The filename pattern is predictable — update before pushing the tag.

### 5. Verify

```bash
npm run lint && npm run typecheck && npm test
```

### 6. Commit and push

```bash
git add package.json CHANGELOG.md README.md
git commit -m "vX.Y.Z"
git push origin main
```

### 7. Push the tag — triggers GitHub Actions

```bash
git tag -a vX.Y.Z -m "vX.Y.Z — <short description>"
git push origin vX.Y.Z
```

The `.github/workflows/release.yml` workflow will:
1. **build-mac** — Build `.dmg` + `.zip` on macOS, create GitHub Release
2. **build-win** — Build `.exe` (NSIS + portable) on Windows, upload to same Release

### 8. Verify the release

Wait for the workflow to complete (~10 min), then check:
- https://github.com/Sindicollo/coins-collection/releases
- Both macOS and Windows artifacts are attached
- Download links in README work (click each link)
- If README was updated after the commit, push a follow-up commit

---

## Local fallback (if GitHub Actions fails)

If the automated workflow fails, build and publish manually:

```bash
# Build macOS .dmg
npm run dist:mac

# Create release
gh release create vX.Y.Z \
  --title "vX.Y.Z — <short description>" \
  --notes-file CHANGELOG.md \
  "dist/Coin Collection-X.Y.Z-arm64.dmg"
```

Note: when uploading manually with `gh`, GitHub converts spaces to hyphens
in the download URL (the filename in the release page will show hyphens).

---

## Notes

- The `release.yml` workflow requires `permissions: contents: write` and
  `env.GH_TOKEN: ${{ secrets.GITHUB_TOKEN }}`.
- Windows builds use `npx electron-rebuild` instead of `npm rebuild` due
  to `node-gyp@9.4.1` incompatibility with Node 20 on Windows.
- The existing `test.yml` skips on tag pushes (`tags-ignore: v*`).
