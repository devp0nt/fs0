# @devp0nt/fs0 - Development Guide

## Quick Start

```bash
# Install dependencies
bun install

# Run tests
bun test

# Build library
bun run build

# Development mode
bun run dev
```

## Development Commands

```bash
# Testing
bun test                    # Run tests
bun test --watch           # Watch mode
bun test --coverage        # With coverage

# Type checking
bun run types          # Build config (strict)
bun run types:dev      # Dev config (includes tests)

# Building
bun run build              # Production build
bun run dev                # Watch mode
```

## Publishing Process

### 1. Version Management
```bash
# Auto-increment version (creates commit + tag)
npm version patch          # 0.1.0 → 0.1.1
npm version minor          # 0.1.0 → 0.2.0
npm version major          # 0.1.0 → 1.0.0
```

### 2. Publish to npm
```bash
# Push version commit and tag
git push origin main --tags

# Build and publish
npm run build
npm publish
```

### 3. Automated Publishing (GitHub Actions)
- Push to `main` branch triggers automatic publishing
- Requires `NPM_TOKEN` secret in repository settings

## Project Structure

```
fs0/
├── src/
│   ├── index.ts          # Main library
│   └── index.test.ts     # Tests
├── dist/                 # Build output
├── package.json          # Package config
├── tsconfig.json         # Dev TypeScript config
├── tsconfig.build.json   # Build TypeScript config
├── tsup.config.ts        # Build configuration
└── bunfig.toml          # Bun configuration
```

## TypeScript Configs

- **`tsconfig.json`** - Development (includes tests, Bun types)
- **`tsconfig.build.json`** - Build (strict, excludes tests)

## Troubleshooting

```bash
# Check Bun version
bun --version

# Clear cache
bun pm cache rm

# Test build output
ls -la dist/
```

## Release Checklist

1. ✅ Run tests: `bun test`
2. ✅ Type check: `bun run types`
3. ✅ Update version: `npm version patch`
4. ✅ Push: `git push origin main --tags`
5. ✅ Publish: `npm publish`
