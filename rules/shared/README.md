# Shared Rules

This directory contains **shared lint rules** that apply to multiple languages.

Since ast-grep requires each rule to specify a `language` field, shared rules are organized
by language subdirectory:

```
rules/shared/
├── rust/
│   ├── no-emojis.yml
│   └── no-leading-whitespace-strings.yml
└── typescript/
    ├── no-emojis.yml
    └── no-leading-whitespace-strings.yml
```

## Rules

| Rule | Description | Languages |
|------|-------------|-----------|
| `no-emojis` | Bans emoji characters in strings | Rust, TypeScript |
| `no-leading-whitespace-strings` | Warns about `" foo"` style strings | Rust, TypeScript |

## How It Works

When you run `tempo-lints rust`, both directories are included:
- `rules/shared/rust/` — shared rules for Rust
- `rules/rust/` — rust-specific rules

When you run `tempo-lints typescript`, both directories are included:
- `rules/shared/typescript/` — shared rules for TypeScript
- `rules/typescript/` — typescript-specific rules

When you run `tempo-lints all`, all rule directories are included.

## Adding a New Shared Rule

1. Create a file in each language subdirectory:
   - `rules/shared/rust/my-rule.yml` with `language: rust`
   - `rules/shared/typescript/my-rule.yml` with `language: typescript`
2. Use the appropriate AST node types for each language:
   - Rust: `string_content`
   - TypeScript: `string_fragment`

## Language-Specific Node Types

| Language | String Content Node |
|----------|---------------------|
| Rust | `string_content` |
| TypeScript | `string_fragment` |
| JavaScript | `string_fragment` |
| Python | `string_content` |
| Go | `interpreted_string_literal` |

To find the node type for a new language, use `ast-grep --pattern '$X' -l <language>` on a sample file.
