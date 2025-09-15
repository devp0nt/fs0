import { afterEach, beforeEach, describe, expect, it } from "bun:test"
import { mkdirSync, rmSync, writeFileSync } from "node:fs"
import { join } from "node:path"
import { File0, Fs0 } from "./index"

describe("Fs0", () => {
  const testDir = join(__dirname, "test-temp")

  beforeEach(() => {
    mkdirSync(testDir, { recursive: true })
  })

  afterEach(() => {
    rmSync(testDir, { recursive: true, force: true })
  })

  it("should create Fs0 instance", () => {
    const fs = Fs0.create()
    expect(fs).toBeInstanceOf(Fs0)
  })

  it("should create Fs0 instance with custom cwd", () => {
    const fs = Fs0.create({ cwd: testDir })
    expect(fs.cwd).toBe(testDir)
  })

  it("should write and read files", async () => {
    const fs = Fs0.create({ cwd: testDir })
    const testContent = "Hello, World!"
    const testFile = "test.txt"

    await fs.writeFile(testFile, testContent)
    const content = await fs.readFile(testFile)

    expect(content).toBe(testContent)
  })

  it("should write and read JSON files", async () => {
    const fs = Fs0.create({ cwd: testDir })
    const testData = { name: "test", version: "1.0.0" }
    const testFile = "test.json"

    await fs.writeJson(testFile, testData)
    const data = await fs.readJson(testFile)

    expect(data).toEqual(testData)
  })

  it("should find files with glob patterns", async () => {
    const fs = Fs0.create({ cwd: testDir })

    // Create test files
    writeFileSync(join(testDir, "file1.ts"), "")
    writeFileSync(join(testDir, "file2.js"), "")
    writeFileSync(join(testDir, "file3.ts"), "")

    const tsFiles = await fs.findFilesPaths("*.ts")
    expect(tsFiles).toHaveLength(2)
    expect(tsFiles.every((file) => file.endsWith(".ts"))).toBe(true)
  })

  it("should check file existence", async () => {
    const fs = Fs0.create({ cwd: testDir })
    const testFile = "exists.txt"

    expect(await fs.isExists(testFile)).toBe(false)

    await fs.writeFile(testFile, "content")
    expect(await fs.isExists(testFile)).toBe(true)
  })

  it("should convert paths correctly", () => {
    const fs = Fs0.create({ cwd: testDir })

    const testPath = "relative/path"
    const expectedAbsPath = join(testDir, testPath)
    const expectedRelPath = "./relative/path"

    const absPath = fs.toAbs(testPath)
    expect(absPath).toBe(expectedAbsPath as any)

    const relPath = fs.toRel(absPath)
    expect(relPath).toBe(expectedRelPath as any)
  })
})

describe("File0", () => {
  const testDir = join(process.cwd(), "test-temp")

  beforeEach(() => {
    mkdirSync(testDir, { recursive: true })
  })

  afterEach(() => {
    rmSync(testDir, { recursive: true, force: true })
  })

  it("should create File0 instance", () => {
    const testFile = join(testDir, "test.txt")
    const file = File0.create({ filePath: testFile })

    expect(file).toBeInstanceOf(File0)
    expect(file.path.abs).toBe(testFile)
  })

  it("should write and read file content", async () => {
    const testFile = join(testDir, "test.txt")
    const file = File0.create({ filePath: testFile })
    const content = "Test content"

    await file.write(content)
    const readContent = await file.read()

    expect(readContent).toBe(content)
  })

  it("should write and read JSON content", async () => {
    const testFile = join(testDir, "test.json")
    const file = File0.create({ filePath: testFile })
    const data = { test: "data", number: 42 }

    await file.writeJson(data)
    const readData = await file.readJson()

    expect(readData).toEqual(data)
  })
})
