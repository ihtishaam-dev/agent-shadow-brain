# Shadow Brain v6.0.3 Release Checklist

Use this checklist before pushing to GitHub or publishing to npm.

## 1. Verify Version

Check these all say `6.0.3`:

```bash
node -p "require('./package.json').version"
node -p "require('./package-lock.json').packages[''].version"
shadow-brain --version
```

## 2. Build And Test

PowerShell-safe commands:

```powershell
npm.cmd run build
npm.cmd test
```

Focused verification used during this upgrade:

```powershell
npx.cmd vitest run tests\brain\live-brain.test.ts tests\brain\context-continuity.test.ts tests\brain\memory-seeder.test.ts
```

## 3. Smoke Test New Commands

```powershell
node .\dist\cli.js live-brain status . --json
node .\dist\cli.js live-brain brief .
node .\dist\cli.js live-brain eval .
node .\dist\cli.js live-brain hygiene .
node .\dist\cli.js live-brain train-pack . --out .\logs\shadow-brain-training-v6.0.3.jsonl
node .\dist\cli.js dash . --no-open --no-analysis --host 127.0.0.1 --port 7343
```

## 4. Inspect Package Contents

```powershell
npm.cmd pack --dry-run
```

Confirm the tarball includes:

- `dist/`
- `README.md`
- `CHANGELOG.md`
- `LICENSE`
- `docs/launch/RELEASE_CHECKLIST_v6.0.3.md`
- `docs/launch/RELEASE_NOTES_v6.0.3.md`
- `tools/export-resume-pack.mjs`
- `tools/record-global-memory.mjs`

## 5. GitHub Release

Recommended tag:

```bash
v6.0.3
```

Recommended release title:

```text
Shadow Brain v6.0.3 - Live Brain
```

Attach or link:

- `README.md`
- `CHANGELOG.md`
- `docs/launch/RELEASE_NOTES_v6.0.3.md`
- build/test output
- npm dry-run output

## 6. npm Publish

Only publish after the dry run looks correct:

```powershell
npm.cmd publish --access public
```

Then verify:

```powershell
npm.cmd view @theihtisham/agent-shadow-brain version
npm.cmd view @theihtisham/agent-shadow-brain description
```

## 7. Post-Publish Smoke Test

In a clean folder:

```powershell
npx.cmd @theihtisham/agent-shadow-brain@6.0.3 --version
npx.cmd @theihtisham/agent-shadow-brain@6.0.3 live-brain status .
```
