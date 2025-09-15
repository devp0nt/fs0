/**
 * @type {import('semantic-release').GlobalConfig}
 */
module.exports = async () => {
  // biome-ignore lint/style/noProcessEnv: <it is ok, here>
  const branch = process.env.GITHUB_REF?.replace('refs/heads/', '') || ''

  const basePlugins = [
    '@semantic-release/commit-analyzer',
    '@semantic-release/release-notes-generator',
    '@semantic-release/changelog',
    '@semantic-release/npm',
    '@semantic-release/github',
  ]

  const gitPlugin = [
    '@semantic-release/git',
    {
      assets: ['package.json', 'CHANGELOG.md'],
      message: 'chore(release): ${nextRelease.version} [skip ci]',
    },
  ]

  return {
    branches: [{ name: 'main' }, { name: 'next', prerelease: true }],
    plugins: branch === 'main' ? [...basePlugins, gitPlugin] : basePlugins,
  }
}
