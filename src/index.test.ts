import { afterEach, beforeEach, describe, expect, it } from 'bun:test'
import { mkdirSync, rmSync, writeFileSync } from 'node:fs'
import nodePath, { join } from 'node:path'
import { fileURLToPath } from 'node:url'

// Check if we should test from built library and which format
// biome-ignore lint/style/noProcessEnv: <ok>
const TEST_FORMAT = process.env.TEST_FORMAT
if (TEST_FORMAT && TEST_FORMAT !== 'esm' && TEST_FORMAT !== 'cjs' && TEST_FORMAT !== 'src') {
  throw new Error('TEST_FORMAT must be either "esm" or "cjs" or "src" or not provided')
}

const importPath = 'index'
let File0: typeof import('./index').File0
let Fs0: typeof import('./index').Fs0

if (TEST_FORMAT === 'cjs') {
  // const cjsModule = await import(`../dist/${importPath}.cjs`)
  const cjsModule = require(`../dist/${importPath}.cjs`)
  File0 = cjsModule.File0
  Fs0 = cjsModule.Fs0
} else if (TEST_FORMAT === 'esm') {
  // Default to ESM
  const esmModule = await import(`../dist/${importPath}.js`)
  File0 = esmModule.File0
  Fs0 = esmModule.Fs0
} else {
  // Import from source
  const sourceModule = await import(`./${importPath}`)
  File0 = sourceModule.File0
  Fs0 = sourceModule.Fs0
}

const __dirname = nodePath.dirname(fileURLToPath(new URL('.', import.meta.url)))

describe(TEST_FORMAT || '', () => {
  describe('Fs0', () => {
    const testDir = join(__dirname, 'test-temp')

    beforeEach(() => {
      mkdirSync(testDir, { recursive: true })
    })

    afterEach(() => {
      rmSync(testDir, { recursive: true, force: true })
    })

    it('should create Fs0 instance', () => {
      const fs = Fs0.create()
      expect(fs).toBeInstanceOf(Fs0)
    })

    it('should create Fs0 instance with custom cwd', () => {
      const fs = Fs0.create({ cwd: testDir })
      expect(fs.cwd).toBe(testDir)
    })

    it('should write and read files', async () => {
      const fs = Fs0.create({ cwd: testDir })
      const testContent = 'Hello, World!'
      const testFile = 'test.txt'

      await fs.writeFile(testFile, testContent)
      const content = await fs.readFile(testFile)

      expect(content).toBe(testContent)
    })

    it('should write and read JSON files', async () => {
      const fs = Fs0.create({ cwd: testDir })
      const testData = { name: 'test', version: '1.0.0' }
      const testFile = 'test.json'

      await fs.writeJson(testFile, testData)
      const data = await fs.readJson(testFile)

      expect(data).toEqual(testData)
    })

    it('should find files with glob patterns', async () => {
      const fs = Fs0.create({ cwd: testDir })

      // Create test files
      writeFileSync(join(testDir, 'file1.ts'), '')
      writeFileSync(join(testDir, 'file2.js'), '')
      writeFileSync(join(testDir, 'file3.ts'), '')

      const tsFiles = await fs.glob('*.ts')
      expect(tsFiles).toHaveLength(2)
      expect(tsFiles.every((file) => file.endsWith('.ts'))).toBe(true)
    })

    it('should check file existence', async () => {
      const fs = Fs0.create({ cwd: testDir })
      const testFile = 'exists.txt'

      expect(await fs.isExists(testFile)).toBe(false)

      await fs.writeFile(testFile, 'content')
      expect(await fs.isExists(testFile)).toBe(true)
    })

    it('should convert paths correctly', () => {
      const fs = Fs0.create({ cwd: testDir })

      const testPath = 'relative/path'
      const expectedAbsPath = join(testDir, testPath)
      const expectedRelPath = './relative/path'

      const absPath = fs.toAbs(testPath)
      expect(absPath).toBe(expectedAbsPath as any)

      const relPath = fs.toRel(absPath)
      expect(relPath).toBe(expectedRelPath as any)
    })

    it('should handle path parsing', () => {
      const fs = Fs0.create({ cwd: testDir })
      const testPath = 'subdir/test-file.ts'

      const parsed = fs.parsePath(testPath)
      expect(parsed.name).toBe('test-file.ts')
      expect(parsed.basename).toBe('test-file')
      expect(parsed.ext).toBe('ts')
      expect(parsed.extDotted).toBe('.ts')
      expect(parsed.dirname).toBe('subdir')
    })

    it('should handle string matching', () => {
      const testString = 'Hello World Test'
      expect(Fs0.isStringMatch(testString, 'World')).toBe(false)
      expect(Fs0.isStringMatch(testString, 'World*')).toBe(false)
      expect(Fs0.isStringMatch(testString, '*World*')).toBe(true)
      expect(Fs0.isStringMatch(testString, 'Hello World Test*')).toBe(true)
      expect(Fs0.isStringMatch(testString, 'Hello World Tes?*')).toBe(true)
      expect(Fs0.isStringMatch(testString, 'Hello World Test?*')).toBe(false)
      expect(Fs0.isStringMatch(testString, 'Universe')).toBe(false)
      expect(Fs0.isStringMatch(testString, ['Hello', 'Test'])).toBe(false)
      expect(Fs0.isStringMatch(testString, /World/)).toBe(true)
    })
  })

  describe('File0', () => {
    const testDir = join(process.cwd(), 'test-temp')

    beforeEach(() => {
      mkdirSync(testDir, { recursive: true })
    })

    afterEach(() => {
      rmSync(testDir, { recursive: true, force: true })
    })

    it('should create File0 instance', () => {
      const testFile = join(testDir, 'test.txt')
      const file = File0.create({ filePath: testFile })

      expect(file).toBeInstanceOf(File0)
      expect(file.path.abs).toBe(testFile)
    })

    it('should write and read file content', async () => {
      const testFile = join(testDir, 'test.txt')
      const file = File0.create({ filePath: testFile })
      const content = 'Test content'

      await file.write(content)
      const readContent = await file.read()

      expect(readContent).toBe(content)
    })

    it('should write and read JSON content', async () => {
      const testFile = join(testDir, 'test.json')
      const file = File0.create({ filePath: testFile })
      const data = { test: 'data', number: 42 }

      await file.writeJson(data)
      const readData = await file.readJson()

      expect(readData).toEqual(data)
    })

    it('should handle path operations', () => {
      const testFile = join(testDir, 'subdir', 'test.txt')
      const file = File0.create({ filePath: testFile })

      expect(file.path.name).toBe('test.txt')
      expect(file.path.basename).toBe('test')
      expect(file.path.ext).toBe('txt')
      expect(file.path.extDotted).toBe('.txt')
      expect(file.path.dirname).toBe('subdir')
    })

    it('should check file existence', async () => {
      const testFile = join(testDir, 'test.txt')
      const file = File0.create({ filePath: testFile })

      expect(await file.isExists()).toBe(false)

      await file.write('content')
      expect(await file.isExists()).toBe(true)
    })
  })

  describe(`Integration Tests`, () => {
    const testDir = join(__dirname, 'test-temp-integration')

    beforeEach(() => {
      mkdirSync(testDir, { recursive: true })
    })

    afterEach(() => {
      rmSync(testDir, { recursive: true, force: true })
    })

    it('should work with complex file operations', async () => {
      const fs = Fs0.create({ cwd: testDir })

      // Create nested directory structure
      await fs.writeFile('nested/deep/file.txt', 'deep content')
      await fs.writeJson('config/app.json', { name: 'app', version: '1.0.0' })

      // Test globbing
      const allFiles = await fs.glob('**/*')
      expect(allFiles.length).toBeGreaterThan(0)

      // Test file operations
      const file = fs.createFile0('nested/deep/file.txt')
      expect(await file.read()).toBe('deep content')

      // Test JSON operations
      const configFile = fs.createFile0('config/app.json')
      const config = await configFile.readJson()
      expect(config.name).toBe('app')
    })

    it('should handle path resolution correctly', () => {
      const fs = Fs0.create({ cwd: testDir })

      const relativePath = '../outside/file.txt'
      const absolutePath = fs.toAbs(relativePath)
      const backToRelative = fs.toRel(absolutePath)

      expect(absolutePath).toContain('outside')
      expect(backToRelative).toContain('..')
    })

    it('should work with findUp functionality', async () => {
      const fs = Fs0.create({ cwd: testDir })

      // Create a package.json file
      await fs.writeJson('package.json', { name: 'test-package' })

      // Test findUp
      const found = await fs.findUp('package.json')
      expect(found).toBeTruthy()
      expect(found).toContain('package.json')
    })
  })
})
