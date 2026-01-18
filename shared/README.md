# Shared Rule Templates

This directory contains **rule templates** that should be copied to language-specific directories.

ast-grep requires each rule to specify a `language` field, so truly language-agnostic rules aren't possible.
Instead, we maintain template rules here that can be adapted for each language.

## Rules

| Template | Description |
|----------|-------------|
| `no-emojis.yml` | Bans emoji characters in strings |
| `no-leading-whitespace-strings.yml` | Warns about `" foo"` style strings |

## Usage

When adding support for a new language:

1. Copy the template to the language-specific `rules/` directory
2. Add the appropriate `language:` field
3. Adjust `kind:` if the AST node type differs (e.g., `string_content` for Rust, `string_fragment` for TypeScript)
