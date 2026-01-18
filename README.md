# Tempo Lints

Shared [ast-grep](https://ast-grep.github.io/) lint rules for Tempo projects.

:warning: This project is under active development :warning:

## Installation

### GitHub Action (Recommended for CI)

```yaml
name: Lint
on: [push, pull_request]

jobs:
  lint:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: stripe/tempo-lints@v1
        with:
          language: rust  # or 'typescript' or 'all'
```

**Action Inputs:**

| Input | Required | Default | Description |
|-------|----------|---------|-------------|
| `language` | ✅ | — | `rust`, `typescript`, or `all` |
| `path` | | `.` | Path to scan |
| `fail-on-error` | | `true` | Fail if errors found |
| `exclude-rules` | | — | Comma-separated rule IDs to skip |
| `fix` | | `false` | Apply auto-fixes where available |
| `post-comment` | | `false` | Post results as PR comment |
| `github-token` | | — | Required if `post-comment: true` |

### npm / npx

```bash
# Run directly with npx
npx @stripe/tempo-lints rust ./src
npx @stripe/tempo-lints typescript
npx @stripe/tempo-lints all --json

# Or install globally
npm install -g @stripe/tempo-lints
tempo-lints rust ./src
```

### Vendoring (for offline/locked environments)

```bash
# Using the CLI vendor command (recommended)
npx @stripe/tempo-lints vendor --lang rust --dest /path/to/your-project
npx @stripe/tempo-lints vendor --lang typescript --dest /path/to/your-project
npx @stripe/tempo-lints vendor --lang all --dest /path/to/your-project
```

This copies both language-specific rules and shared rules to `.ast-grep/` and generates an `sgconfig.yml`.

After vendoring, run lints with:

```bash
ast-grep scan --config sgconfig.yml
```

## CLI Usage

```
tempo-lints <language> [path] [options]

Arguments:
  language     Required: rust, typescript, or all
  path         Path to scan (default: current directory)

Options:
  --exclude <rules>   Comma-separated list of rules to exclude
  --json              Output results as JSON
  --fix               Apply auto-fixes where available
  --github-action     Output in GitHub Actions format with annotations
  --help, -h          Show help
  --version, -v       Show version

Examples:
  tempo-lints rust
  tempo-lints typescript ./src
  tempo-lints all --json
  tempo-lints rust --exclude no-dbg-macro,no-unwrap-in-lib
  tempo-lints typescript --fix
  tempo-lints rust --github-action   # For CI with annotations

Vendor Subcommand:
  tempo-lints vendor --lang <language> --dest <path>

  Copy lint rules to a destination project for offline/locked usage.

  Options:
    --lang <language>   Language rules to vendor (rust, typescript, or all)
    --dest <path>       Destination project path

  Examples:
    tempo-lints vendor --lang rust --dest ./my-project
    tempo-lints vendor --lang all --dest /path/to/project
```

## Disabling Rules

### Line-level disable

```rust
// ast-grep-ignore: no-emojis
let emoji = "🎉";
```

```typescript
// ast-grep-ignore: no-console-log
console.log("debug");
```

### Block-level disable

```rust
// ast-grep-ignore-start
let emoji1 = "🎉";
let emoji2 = "🚀";
// ast-grep-ignore-end
```

## Adding New Rules

1. Create the rule YAML in the appropriate `rules/` directory
2. Add test cases in `rules/<language>/tests/<rule-id>-test.yml`
3. Run `npm test` to generate snapshots

## Development

```bash
# Install dependencies
npm install

# Test all rules
npm test

# Test specific language
npm run test:rust
npm run test:typescript
npm run test:shared-rules

# Update snapshots
npm run test:update-snapshots

# Typecheck
npm run typecheck

# Lint & format
npm run check

# Scan a directory manually
ast-grep scan --config rules/rust/sgconfig.yml /path/to/code
```

## Contributing

1. Fork this repo
2. Add or modify rules
3. Run `npm test` to verify
4. Open a PR with description of the rule and rationale
