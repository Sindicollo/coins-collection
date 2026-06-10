---
name: github-release
description: Use when the user asks to make a release, publish a release, create a GitHub release, bump version, or ship a new version of the app. Covers bumping version in package.json, updating CHANGELOG.md and README.md, building the .dmg, tagging, and creating a GitHub release with gh CLI.
---

# GitHub Release

Create and publish a GitHub release for the coin-collection Electron app.

## Prerequisites

- Ensure `gh` CLI is authenticated (`gh auth status`)
- Ensure Electron builder is configured (`electron-builder.yml`)
- The app must build successfully: `npm run build` works
- The `CHANGELOG.md` must have an entry for the new version

## Steps

### 1. Determine the version

Ask the user for the version number (e.g. `1.2.0`). If they don't specify,
check the current version in `package.json` and suggest the next semver bump
(patch/minor/major).

### 2. Bump version in package.json

```bash
# Read current version, update it
edit package.json: "version": "1.X.Y" → "version": "<new_version>"
```

### 3. Update CHANGELOG.md

Add a new section at the top with the version number, following the existing
format:

```markdown
## vX.Y.Z

### Added
- ...

### Changed
- ...

### Fixed
- ...
```

Use English only. Write concise, user-facing bullet points.

### 4. Update README.md

Update the download link to point to the new version:

```markdown
[**Download .dmg**](https://github.com/Sindicollo/coins-collection/releases/download/v<version>/Coin.Collection-<version>-arm64.dmg)
```

The `.dmg` filename follows the pattern: `Coin Collection-<version>-arm64.dmg`
(note the space, not a dot). Compare with previous releases in README for the
exact format.

Also update the file size estimate (`~110 MB` or similar).

### 5. Verify

```bash
npm run lint && npm run typecheck
```

### 6. Build the .dmg

```bash
npm run dist:mac
```

The `.dmg` will be in `dist/Coin Collection-<version>-arm64.dmg`.

### 7. Commit and push

```bash
git add package.json CHANGELOG.md README.md
git commit -m "v<version>"
git push origin main
```

### 8. Create and push the git tag

```bash
git tag -a v<version> -m "v<version> — <short description>"
git push origin v<version>
```

### 9. Create the GitHub release

```bash
gh release create v<version> \
  --title "v<version> — <short description>" \
  --notes-file CHANGELOG.md \
  "dist/Coin Collection-<version>-arm64.dmg"
```

**Important:** `--notes-file CHANGELOG.md` will include the ENTIRE changelog
as release notes. If you want only the current version's notes, extract that
section first:

```bash
# Extract only the latest version section (between first ## and second ##)
sed -n '/^## v<version>/,/^## v/p' CHANGELOG.md | sed '$d' > /tmp/release-notes.md
gh release create v<version> \
  --title "v<version> — <short description>" \
  --notes-file /tmp/release-notes.md \
  "dist/Coin Collection-<version>-arm64.dmg"
```

### 10. Verify the release

Open the release URL printed by the `gh` command and check that:
- The `.dmg` is attached
- The release notes look correct
- The download link works

## After the release

Tell the user the release URL. Remind them that the README download link now
points to the new `.dmg`.
