# Tempo Lints

Shared [ast-grep](https://ast-grep.github.io/) lint rules for Tempo projects.

## Structure

```
lints/
├── shared/          # Rule templates (must be copied to language dirs)
├── rust/            # Rust-specific rules
│   ├── rules/
│   ├── tests/
│   └── sgconfig.yml
├── typescript/      # TypeScript-specific rules
│   ├── rules/
│   ├── tests/
│   └── sgconfig.yml
└── scripts/         # Helper scripts for consumers
```

## Usage

### Vendoring into your project

Copy the relevant language folder into your project:

```bash
# For a Rust project
cp -r rust/ /path/to/your-project/.ast-grep/

# For a TypeScript project
cp -r typescript/ /path/to/your-project/.ast-grep/
```

Or use the vendor script:

```bash
./scripts/vendor.sh --lang rust --dest /path/to/your-project
```

### Running locally

```bash
# Test all rules
make test

# Test specific language
make test-rust
make test-typescript

# Scan a directory with rules
ast-grep scan --config rust/sgconfig.yml /path/to/code
```

## Rules

### Shared Rules (copied to each language)

| Rule | Severity | Description |
|------|----------|-------------|
| `no-emojis` | error | Bans emoji characters in code |
| `no-leading-whitespace-strings` | warning | Warns about `" foo"` style strings |

### Rust Rules

| Rule | Severity | Description |
|------|----------|-------------|
| `unsafe-needs-safety-comment` | warning | Flags unsafe blocks for review |
| `no-mem-transmute` | error | Bans `mem::transmute` without justification |
| `no-unwrap-in-lib` | warning | Bans `.unwrap()` outside test code |
| `no-dbg-macro` | error | Bans `dbg!()` macro |
| `tracing-no-format` | warning | Forbids `format!()` inside `tracing::*!()` |

### TypeScript Rules

| Rule | Severity | Description |
|------|----------|-------------|
| `no-console-log` | warning | Bans `console.log` (use structured logging) |
| `no-explicit-any` | warning | Bans explicit `any` type annotations |
| `no-non-null-assertion` | warning | Bans `!` non-null assertions |
| `no-await-in-loop` | warning | Warns about await inside loops |
| `prefer-const` | hint | Suggests `const` over `let` |

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
2. Add test cases in `tests/<rule-id>-test.yml`
3. Run `make test` to generate snapshots
4. Document in this README

## CI Integration

Example GitHub Actions job:

```yaml
ast-grep:
  runs-on: ubuntu-latest
  steps:
    - uses: actions/checkout@v4
    - name: Install ast-grep
      run: npm install -g @ast-grep/cli
    - name: Run ast-grep
      run: ast-grep scan --config .ast-grep/sgconfig.yml
```

## Contributing

1. Fork this repo
2. Add or modify rules
3. Run `make test` to verify
4. Open a PR with description of the rule and rationale
