# Release and Commit Guidelines

This document outlines the commit conventions, development workflow, and release process for the MCP Agent Hub project.

## Commit Conventions

We use [Conventional Commits](https://www.conventionalcommits.org/) to maintain a clear commit history and enable automated changelog generation.

### Commit Message Format

```
<type>(<scope>): <description>

[optional body]

[optional footer(s)]
```

### Commit Types

| Type | Description | Example |
|------|-------------|---------|
| `feat` | New feature | `feat(messaging): add idempotency key support` |
| `fix` | Bug fix | `fix(api): correct pagination cursor format` |
| `docs` | Documentation only | `docs(readme): update installation instructions` |
| `refactor` | Code refactoring | `refactor(db): extract query builders` |
| `test` | Adding/updating tests | `test(hub): add conversation member tests` |
| `chore` | Maintenance tasks | `chore(deps): update typescript to 5.7` |
| `perf` | Performance improvement | `perf(db): add index for unread queries` |
| `ci` | CI/CD changes | `ci(github): add node 22 to test matrix` |

### Scopes

Common scopes for this project:
- `api` - HTTP API changes
- `messaging` - Message handling
- `db` - Database schema or queries
- `hub` - Hub server
- `client` - MCP client SDK
- `bridge` - MCP bridge
- `docs` - Documentation
- `ci` - CI/CD configuration

### Examples

```
feat(api): add cursor pagination to history endpoint

Implements cursor-based pagination using created_at|id format.
Returns nextCursor in response for subsequent requests.

Closes #42
```

```
fix(messaging): correct receipt creation for sender

The sender should not receive a receipt for their own message.
Previously, receipts were created for all members including sender.
```

## Development Workflow

### Feature Development Process

1. **Create a branch**
   ```bash
   git checkout -b feat/my-feature
   ```

2. **Develop the feature**
   - Write code
   - Add/update tests
   - Update documentation

3. **Commit changes**
   ```bash
   git add .
   git commit -m "feat(scope): description"
   ```

4. **Push and create PR**
   ```bash
   git push origin feat/my-feature
   ```

5. **Merge after review and CI pass**

### Commit Completeness Rule

Every feature commit must include:

1. ✅ **Code changes** - The feature implementation
2. ✅ **Tests** - Unit/integration tests for the behavior
3. ✅ **Documentation** - Updates to relevant docs

This ensures each commit represents a complete, documented, and tested change.

## CI/CD Pipeline

### Automated Checks

All pull requests and pushes to main must pass:

```bash
# Type checking
npm run typecheck

# Tests
npm run test

# Build
npm run build
```

### GitHub Actions Workflow

See [`.github/workflows/ci.yml`](../.github/workflows/ci.yml)

The workflow:
1. Sets up Node.js 20
2. Installs dependencies with `npm ci`
3. Runs typecheck
4. Runs tests
5. Runs build

### Pre-commit Checklist

Before committing:

```bash
# Run all checks
npm run typecheck && npm run test && npm run build
```

## Versioning

We follow [Semantic Versioning](https://semver.org/):

- **MAJOR** - Breaking API changes
- **MINOR** - New features (backward compatible)
- **PATCH** - Bug fixes (backward compatible)

### Version Bump Process

1. Update version in `package.json`
2. Update `CHANGELOG.md`
3. Commit with `chore(release): bump version to x.y.z`
4. Tag: `git tag vx.y.z`
5. Push tags: `git push origin --tags`

## Changelog

Maintain `CHANGELOG.md` following [Keep a Changelog](https://keepachangelog.com/) format:

```markdown
## [Unreleased]

### Added
- New feature description

### Fixed
- Bug fix description

## [0.1.0] - 2024-01-15

### Added
- Initial release
- Agent registration
- Conversation management
- Messaging system
```

## Release Process

### Pre-release Checklist

- [ ] All tests passing
- [ ] Documentation updated
- [ ] CHANGELOG.md updated
- [ ] Version bumped in package.json files
- [ ] Tag created
- [ ] GitHub release drafted

### Release Steps

1. **Prepare release branch**
   ```bash
   git checkout -b release/v0.2.0
   ```

2. **Update version and changelog**
   - Bump version in all package.json files
   - Update CHANGELOG.md

3. **Commit and tag**
   ```bash
   git add .
   git commit -m "chore(release): bump version to 0.2.0"
   git tag v0.2.0
   ```

4. **Push and merge**
   ```bash
   git push origin release/v0.2.0 --tags
   ```

5. **Create GitHub release**
   - Use tag v0.2.0
   - Copy relevant CHANGELOG section
   - Attach build artifacts if needed

## Code Review Guidelines

### For Authors

- Keep PRs focused on a single feature/fix
- Include clear description with motivation
- Reference related issues
- Ensure CI passes before requesting review

### For Reviewers

- Check for test coverage
- Verify documentation updates
- Validate API consistency
- Test locally if needed
- Approve only when CI passes

## Documentation Standards

When updating documentation:

1. Keep language clear and concise
2. Include request/response examples for APIs
3. Document error cases
4. Add usage examples for features
5. Update table of contents if structure changes
6. Cross-reference related documents

