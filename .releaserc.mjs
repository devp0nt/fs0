/**
 * @type {import('semantic-release').GlobalConfig}
 */
export default {
  branches: ['main'],
  plugins: [
    '@semantic-release/commit-analyzer', // determines next version based on conventional commits
    '@semantic-release/release-notes-generator', // generates release notes
    '@semantic-release/changelog', // updates CHANGELOG.md
    '@semantic-release/npm', // updates package.json and publishes to npm
    '@semantic-release/github', // creates GitHub Release
    [
      '@semantic-release/git', // commits back package.json + CHANGELOG.md
      {
        assets: ['package.json', 'CHANGELOG.md'],
        message: 'chore(release): ${nextRelease.version} [skip ci]',
      },
    ],
  ],
}
