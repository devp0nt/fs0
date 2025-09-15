# @devp0nt/fs0 - Development Guide

This guide explains how to develop, test, and deploy the fs0 library.

## Prerequisites

- [Bun](https://bun.sh) >= 1.0.0
- Node.js >= 18.0.0 (for compatibility)
- npm account with access to publish packages

## Development Commands

### Setup

```bash
# Install dependencies
bun install

# Verify installation
bun --version
```

### Development Workflow

```bash
# Run tests
bun test

# Run tests in watch mode
bun test --watch

# Run tests with coverage
bun test --coverage

# Type checking (build config - strict)
bun run typecheck

# Type checking (dev config - includes tests and bun types)
bun run typecheck:dev

# Build the library
bun run build

# Development mode (watch for changes)
bun run dev

# Clean build artifacts
bun run clean
```

### Testing

```bash
# Run all tests
bun test

# Run specific test file
bun test src/index.test.ts

# Run tests with verbose output
bun test --verbose

# Run tests in watch mode for development
bun test --watch
```

## Build Process

The library is built using `tsup` which creates both ESM and CommonJS outputs:

```bash
# Build for production
bun run build

# This creates:
# - dist/index.js (ESM)
# - dist/index.cjs (CommonJS)
# - dist/index.d.ts (TypeScript declarations)
# - dist/index.d.ts.map (Declaration source maps)
```

## Deployment

### Pre-deployment Checklist

1. **Update version** in `package.json`
2. **Run tests** to ensure everything works
3. **Build the library** to verify build process
4. **Test the build output** manually if needed

### Version Management

```bash
# Update version (patch, minor, major)
npm version patch
npm version minor
npm version major

# Or manually edit package.json
```

### Publishing to npm

#### Method 1: Manual Publishing

```bash
# 1. Build the library
bun run build

# 2. Test the build
node dist/index.cjs --version || echo "CJS build works"
node --input-type=module -e "import('./dist/index.js').then(() => console.log('ESM build works'))"

# 3. Login to npm (if not already logged in)
npm login

# 4. Publish to npm
npm publish

# 5. Verify publication
npm view @devp0nt/fs0
```

#### Method 2: Using npm scripts

```bash
# This will automatically clean, build, and publish
npm run prepublishOnly && npm publish
```

#### Method 3: Automated via GitHub Actions

The repository includes a GitHub Actions workflow that automatically:

1. Runs tests on multiple Node.js and Bun versions
2. Builds the library
3. Publishes to npm when pushing to `main` branch

**Setup for automated publishing:**

1. Create an npm token:
   - Go to [npmjs.com](https://www.npmjs.com) → Account Settings → Access Tokens
   - Generate a new token with "Automation" type
   - Copy the token

2. Add the token to GitHub repository secrets:
   - Go to your GitHub repository → Settings → Secrets and variables → Actions
   - Add a new secret named `NPM_TOKEN` with your npm token

3. Push to main branch to trigger automatic publishing

### Testing Published Package

```bash
# Test the published package
npm pack
tar -tzf devp0nt-fs0-*.tgz

# Or install in a test project
mkdir test-package
cd test-package
npm init -y
npm install ../path/to/fs0/dist
```

## CI/CD Pipeline

The project uses GitHub Actions for continuous integration:

### Workflow Features

- **Multi-version testing**: Tests on Node.js 18, 20, 21 and Bun 1.0.0, latest
- **Type checking**: Ensures TypeScript compilation
- **Build verification**: Tests both ESM and CJS outputs
- **Automated publishing**: Publishes to npm on main branch pushes

### Workflow Files

- `.github/workflows/ci.yml` - Main CI/CD pipeline

### Manual Workflow Triggers

```bash
# Trigger workflow manually (if needed)
gh workflow run ci.yml
```

## Troubleshooting

### Common Issues

1. **TypeScript errors**: Run `bun run typecheck` to identify issues
2. **Build failures**: Check `tsup.config.ts` configuration
3. **Test failures**: Run `bun test --verbose` for detailed output
4. **Publishing errors**: Verify npm login and package name availability

### Debug Commands

```bash
# Check Bun version
bun --version

# Check installed dependencies
bun pm ls

# Clear Bun cache
bun pm cache rm

# Check build output
ls -la dist/

# Test specific functionality
bun -e "import { Fs0 } from './src/index.ts'; console.log('Import works')"
```

## TypeScript Configuration

The project uses two TypeScript configurations:

- **`tsconfig.json`** - Development configuration
  - Includes test files
  - Includes Bun types
  - Relaxed unused variable checking
  - No declaration files generated

- **`tsconfig.build.json`** - Build configuration
  - Extends the main config
  - Excludes test files
  - Only Node.js types
  - Strict unused variable checking
  - Generates declaration files

## Project Structure

```
fs0/
├── src/
│   ├── index.ts          # Main library code
│   └── index.test.ts     # Test suite
├── dist/                 # Build output (generated)
├── .github/
│   └── workflows/
│       └── ci.yml        # CI/CD pipeline
├── package.json          # Package configuration
├── tsconfig.json         # Development TypeScript config
├── tsconfig.build.json   # Build TypeScript config
├── tsup.config.ts        # Build configuration
├── bunfig.toml          # Bun configuration
├── .gitignore           # Git ignore rules
└── LICENSE              # MIT license
```

## Development Tips

1. **Use Bun for development**: It's faster than Node.js for most operations
2. **Watch mode**: Use `bun test --watch` during development
3. **Type checking**: Run `bun run typecheck` before committing
4. **Build testing**: Always test the build output before publishing
5. **Version management**: Use semantic versioning (semver) for releases

## Release Process

1. **Development**: Make changes and test locally
2. **Version bump**: Update version in `package.json`
3. **Commit**: Commit changes with descriptive message
4. **Push**: Push to main branch
5. **Verify**: Check GitHub Actions for successful build
6. **Publish**: Package is automatically published to npm
7. **Test**: Verify the published package works in a test project

## Support

For development questions or issues:
- Check the test files for usage examples
- Review the CI/CD logs for build issues
- Open an issue in the GitHub repository
