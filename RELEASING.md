# Releasing

The plugin is published in Obsidian's community-plugins directory (repo `trietment/obsidian-kanban`). Obsidian installs/updates from the **GitHub release assets**; the plugin page in Obsidian renders **README.md** from `main`.

1. Branch from `main` (e.g. `fix-something`) and commit the code changes (`main.js`, `styles.css`).
2. Add the new version's notes:
   - Prepend a `## x.y.z` section to `CHANGELOG.md` (English bullets, then `---` and `### Nederlands`).
   - Run `scripts/sync-readme-changelog.sh` — mirrors the changelog into the block at the end of `README.md`, which is what the plugin page shows.
   - Rewrite `release-notes.md` with this version's notes only (becomes the GitHub release body).
3. Bump the version: `manifest.json` and a new entry in `versions.json`.
4. Commit as `Release x.y.z: notes, changelog, version bump`, push, open a PR, merge it (merge commit).
5. From updated `main`:
   `gh release create x.y.z main.js manifest.json styles.css --title "x.y.z" --notes-file release-notes.md`
6. Update this Mac's vault copy: `cp main.js styles.css manifest.json ~/notes/Trietment/.obsidian/plugins/trietment-kanban/` (other devices update via Obsidian's community-plugins updater).
