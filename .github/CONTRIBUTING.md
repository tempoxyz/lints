# Contributing to Tempo Lints

Thank you for your interest in contributing! This guide will help you get started.

## Development Setup

1. **Clone the repository:**
   ```bash
   git clone https://github.com/tempoxyz/lints.git
   cd lints
   ```

2. **Install dependencies:**
   ```bash
   pnpm install
   ```

3. **Verify everything works:**
   ```bash
   pnpm test
   pnpm typecheck
   pnpm lint
   ```

## Making Changes

1. **Create a new branch:**
   ```bash
   git checkout -b your-feature-name
   ```

2. **Make your changes:**
   - Add or modify lint rules in `src/rust/rules/` or `src/typescript/rules/`
   - Add tests in `src/*/tests/`
   - Update documentation if needed

3. **Test your changes:**
   ```bash
   # Run all tests
   pnpm test

   # Run specific language tests
   pnpm test:rust
   pnpm test:typescript

   # Type check
   pnpm typecheck

   # Lint
   pnpm lint
   ```

4. **Create a changeset:**

   Before committing, create a changeset to document your changes:

   ```bash
   pnpm changeset
   ```

   This will prompt you to:
   - Select the type of change (patch/minor/major)
   - Write a summary of your change

   The changeset file will be committed along with your changes.

   **Change types:**
   - **Patch** (`0.0.x`): Bug fixes, documentation updates, minor improvements
   - **Minor** (`0.x.0`): New features, new rules, backward-compatible changes
   - **Major** (`x.0.0`): Breaking changes (rarely needed)

5. **Commit your changes:**
   ```bash
   git add .
   git commit -m "feat: add new rule for xyz"
   ```

6. **Push and create a pull request:**
   ```bash
   git push origin your-feature-name
   ```

   Then create a PR on GitHub.

## Release Process

Releases are automated using Changesets:

1. When PRs with changesets are merged to `main`, a "Version Packages" PR is automatically created
2. The Version Packages PR:
   - Bumps the version in `package.json`
   - Updates `CHANGELOG.md` with all changeset summaries
   - Deletes the consumed changeset files
3. When maintainers merge the Version Packages PR:
   - A GitHub Release is created
   - Git tags are created and pushed
   - Major version tags (e.g., `v0`, `v1`) are updated to point to the latest release

## Adding New Rules

To add a new lint rule:

1. **Create the rule file:**
   ```
   src/rust/rules/your-rule-name.yml
   # or
   src/typescript/rules/your-rule-name.yml
   ```

2. **Add test cases:**
   ```
   src/rust/tests/your-rule-name-test.yml
   # or
   src/typescript/tests/your-rule-name-test.yml
   ```

3. **Run tests to generate snapshots:**
   ```bash
   pnpm test
   ```

4. **Document the rule:**
   - Add description and rationale to the rule YAML file
   - Update README.md if the rule is noteworthy

## Code Style

- We use [Biome](https://biomejs.dev/) for linting and formatting
- Run `pnpm check` to format code automatically
- Run `pnpm lint` to check for issues

## Questions?

If you have questions or need help:
- Open an issue on GitHub
- Check existing issues for similar questions
- Review the [ast-grep documentation](https://ast-grep.github.io/)

Thank you for contributing! 🎉
