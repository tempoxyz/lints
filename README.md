# Tempo Lints

Shared [ast-grep](https://ast-grep.github.io/) lint rules for Tempo projects.

:warning: This project is under active development :warning:

## Prerequisites

This package requires [ast-grep](https://ast-grep.github.io/) (`sg` CLI) to run lints.

### Installing ast-grep

**macOS (Homebrew):**
```bash
brew install ast-grep
```

**Cargo (Rust):**
```bash
cargo install ast-grep --locked
```

**npm (global):**
```bash
npm install -g @ast-grep/cli
```

**Verify installation:**
```bash
sg --version
# Should output: ast-grep 0.25.x or higher
```

> **Note:** When using this package via npm/pnpm, the `@ast-grep/cli` dependency is included and installs the `sg` binary automatically via postinstall.

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
      - uses: tempoxyz/lints@v0
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

### npm / npx (via GitHub)

Install directly from GitHub:

```bash
# Install from GitHub
npm install github:tempoxyz/lints

# Run with npx
npx @tempoxyz/lints rust ./src
npx @tempoxyz/lints typescript
npx @tempoxyz/lints all --json
```

Or use npx directly without installing:

```bash
npx github:tempoxyz/lints rust ./src
```

### Vendoring (for offline/locked environments)

```bash
# Using the CLI vendor command (recommended)
npx @tempoxyz/lints vendor --lang rust --dest /path/to/your-project
npx @tempoxyz/lints vendor --lang typescript --dest /path/to/your-project
npx @tempoxyz/lints vendor --lang all --dest /path/to/your-project
```

This copies both language-specific rules and shared rules to `.ast-grep/` and generates an `sgconfig.yml`.

After vendoring, run lints with:

```bash
ast-grep scan --config sgconfig.yml
```

## CLI Usage

```
@tempoxyz/lints <language> [path] [options]

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
  npx @tempoxyz/lints rust
  npx @tempoxyz/lints typescript ./src
  npx @tempoxyz/lints all --json
  npx @tempoxyz/lints rust --exclude no-dbg-macro,no-unwrap-in-lib
  npx @tempoxyz/lints typescript --fix
  npx @tempoxyz/lints rust --github-action   # For CI with annotations

Vendor Subcommand:
  npx @tempoxyz/lints vendor --lang <language> --dest <path>

  Copy lint rules to a destination project for offline/locked usage.

  Options:
    --lang <language>   Language rules to vendor (rust, typescript, or all)
    --dest <path>       Destination project path

  Examples:
    npx @tempoxyz/lints vendor --lang rust --dest ./my-project
    npx @tempoxyz/lints vendor --lang all --dest /path/to/project
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
ast-grep scan --config src/rust/sgconfig.yml /path/to/code
```

## Versioning

This package uses GitHub releases for distribution. When using the GitHub Action, you can pin to major versions:

```yaml
- uses: tempoxyz/lints@v0  # Automatically uses latest v0.x.x
- uses: tempoxyz/lints@v0.2.1  # Pin to specific version
- uses: tempoxyz/lints@main  # Use latest from main branch (not recommended)
```

Major version tags (`v0`, `v1`, etc.) are automatically updated to point to the latest release in that major version.

## Contributing

We welcome contributions! Please see our [Contributing Guide](.github/CONTRIBUTING.md) for details.

**Quick start:**

1. Fork this repo
2. Make your changes
3. Create a changeset: `pnpm changeset`
4. Run tests: `pnpm test`
5. Open a PR

See [.github/CONTRIBUTING.md](.github/CONTRIBUTING.md) for detailed instructions on:
- Development setup
- Creating changesets
- Adding new rules
- Release process
