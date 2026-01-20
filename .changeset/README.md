# Changesets

Hello! 👋

This folder contains [Changesets](https://github.com/changesets/changesets) for the project. Changesets help us manage version bumps and changelogs.

## Creating a Changeset

When you make a change that should be included in the next release, create a changeset by running:

```bash
pnpm changeset
```

This will:
1. Ask you to select the type of change (patch, minor, or major)
2. Prompt you to write a summary of the change
3. Create a new changeset file in this directory

## What gets a changeset?

Create a changeset for:
- Bug fixes (patch)
- New features (minor)
- Breaking changes (major)
- Documentation improvements (patch)
- Performance improvements (patch)

## Releasing

When changesets are merged to `main`, our release workflow will:
1. Create a "Version Packages" PR that consumes all changesets
2. Update the version in `package.json`
3. Update `CHANGELOG.md`
4. When the Version Packages PR is merged, create a GitHub Release with the changelog

For more information, see the [Changesets documentation](https://github.com/changesets/changesets/blob/main/docs/intro-to-using-changesets.md).
