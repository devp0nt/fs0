import { exec, execSync } from "node:child_process"
import fsSync from "node:fs"
import fs from "node:fs/promises"
import nodePath from "node:path"
import readline from "node:readline"
import CommentJson from "comment-json"
import dotenv from "dotenv"
import { findUp, findUpSync } from "find-up"
import { type Options as GlobbyOptions, globby, globbySync } from "globby"
import { createJiti } from "jiti"
import uniq from "lodash-es/uniq.js"
import micromatch from "micromatch"

// TODO: При импорте файла через джити находить ближайший тсконфиг и тянуть из него paths чтобы разрезолвить алиасы абсолютно, и вообще вторым аргументом любые настройкли джити
// TODO: убрать importDefualt, путсь черехз настройки управляется

export class Fs0 {
  rootDir: string
  cwd: string
  formatCommand: string | undefined

  private constructor(input: Fs0.CreateFsInput = {}) {
    if ("fileDir" in input && input.fileDir) {
      this.cwd = input.fileDir
    } else if ("filePath" in input && input.filePath) {
      this.cwd = nodePath.dirname(input.filePath)
    } else if ("cwd" in input && input.cwd) {
      this.cwd = input.cwd
    } else {
      this.cwd = process.cwd()
    }
    this.rootDir = input.rootDir || this.cwd
    if (!this.rootDir.startsWith("/")) {
      throw new Error("Root dir must be absolute")
    }
    this.cwd = nodePath.resolve(this.rootDir, this.cwd)
    this.formatCommand = input.formatCommand
  }
  static create(input: Fs0.CreateFsInput = {}) {
    return new Fs0(input)
  }
  createFs0(input: Fs0.CreateFsInput = {}) {
    let cwd: undefined | string
    if ("fileDir" in input && input.fileDir) {
      cwd = this.resolve(input.fileDir)
    } else if ("filePath" in input && input.filePath) {
      cwd = this.resolve(nodePath.dirname(input.filePath))
    } else if ("cwd" in input && input.cwd) {
      cwd = this.resolve(input.cwd)
    }
    const rootDir = this.resolve(input.rootDir || this.rootDir)
    return Fs0.create({ ...input, rootDir, cwd })
  }

  setRootDir(rootDir: string) {
    this.rootDir = rootDir
  }
  setCwd(cwd: string) {
    this.cwd = cwd
  }

  static isStringMatch = (str: string | undefined, search: Fs0.StringMatchInput): boolean => {
    if (!str) return false
    if (Array.isArray(search)) {
      return search.some((item) => Fs0.isStringMatch(str, item))
    } else if (typeof search === "string") {
      return str.includes(search)
    } else {
      return search.test(str)
    }
  }

  async findFilesPaths(glob: Fs0.PathOrPaths): Promise<string[]>
  async findFilesPaths({
    cwd,
    glob,
    relative,
  }: {
    cwd?: string
    glob: Fs0.PathOrPaths
    relative?: string | boolean
  }): Promise<string[]>
  async findFilesPaths(
    input:
      | Fs0.PathOrPaths
      | {
          cwd?: string
          glob: Fs0.PathOrPaths
          relative?: string | boolean
        },
  ): Promise<string[]> {
    const { cwd, glob, relative } = (() => {
      if (typeof input === "string" || Array.isArray(input)) {
        return {
          cwd: this.rootDir,
          glob: this.toPaths(input),
          relative: undefined,
        }
      }
      if (typeof input === "object" && input !== null) {
        return {
          cwd: input.cwd || this.rootDir,
          glob: this.toPaths(input.glob),
          relative: input.relative,
        }
      }
      throw new Error("Invalid input")
    })()
    const paths = await globby(glob, { cwd, gitignore: true, absolute: true, dot: true })
    if (!relative) {
      return paths
    } else if (relative === true) {
      return paths.map((path) => this.toRel(path))
    } else {
      return paths.map((path) => this.toRel(path, relative))
    }
  }

  findFilesPathsSync(glob: Fs0.PathOrPaths): string[]
  findFilesPathsSync({
    cwd,
    glob,
    relative,
  }: {
    cwd?: string
    glob: Fs0.PathOrPaths
    relative?: string | boolean
  }): string[]
  findFilesPathsSync(
    input:
      | Fs0.PathOrPaths
      | {
          cwd?: string
          glob: Fs0.PathOrPaths
          relative?: string | boolean
        },
  ): string[] {
    const { cwd, glob, relative } = (() => {
      if (typeof input === "string" || Array.isArray(input)) {
        return {
          cwd: this.rootDir,
          glob: this.toPaths(input),
          relative: undefined,
        }
      }
      if (typeof input === "object" && input !== null) {
        return {
          cwd: input.cwd || this.rootDir,
          glob: this.toPaths(input.glob),
          relative: input.relative,
        }
      }
      throw new Error("Invalid input")
    })()
    const paths = globbySync(glob, { cwd, gitignore: true, absolute: true, dot: true })
    if (!relative) {
      return paths
    } else if (relative === true) {
      return paths.map((path) => this.toRel(path))
    } else {
      return paths.map((path) => this.toRel(path, relative))
    }
  }

  async glob(
    glob: string | string[],
    {
      cwd = this.rootDir,
      relative,
      ...restOptions
    }: {
      cwd?: string
      relative?: string | boolean
    } & GlobbyOptions = {},
  ): Promise<string[]> {
    glob = this.toAbs(this.toPaths(glob))
    const paths = await globby(glob, { gitignore: true, absolute: true, dot: true, cwd, ...restOptions })
    if (!relative) {
      return paths
    } else if (relative === true) {
      return paths.map((path) => this.toRel(path))
    } else {
      return paths.map((path) => this.toRel(path, relative))
    }
  }

  globSync(
    glob: string | string[],
    {
      cwd = this.rootDir,
      relative,
      ...restOptions
    }: {
      cwd?: string
      relative?: string | boolean
    } & GlobbyOptions = {},
  ): string[] {
    glob = this.toAbs(this.toPaths(glob))
    const paths = globbySync(glob, { gitignore: true, absolute: true, dot: true, cwd, ...restOptions })
    if (!relative) {
      return paths
    } else if (relative === true) {
      return paths.map((path) => this.toRel(path))
    } else {
      return paths.map((path) => this.toRel(path, relative))
    }
  }

  async globFile0(
    glob: string | string[],
    { cwd, relative, ...restOptions }: { cwd?: string; relative?: string | boolean } & GlobbyOptions = {},
  ): Promise<File0[]> {
    const paths = await this.glob(glob, { cwd, relative, ...restOptions })
    return paths.map((path) => this.createFile0(path))
  }
  globFile0Sync(
    glob: string | string[],
    { cwd, relative, ...restOptions }: { cwd?: string; relative?: string | boolean } & GlobbyOptions = {},
  ): File0[] {
    const paths = this.globSync(glob, { cwd, relative, ...restOptions })
    return paths.map((path) => this.createFile0(path))
  }

  async isContentMatch(path: string, search: Fs0.StringMatchInput): Promise<boolean> {
    const pathNormalized = this.normalizePath(path)
    return new Promise((resolve, reject) => {
      const stream = fsSync.createReadStream(pathNormalized, { encoding: "utf8" })
      const rl = readline.createInterface({ input: stream })
      let found = false
      rl.on("line", (line) => {
        if (Fs0.isStringMatch(line, search)) {
          found = true
          rl.close()
        }
      })
      rl.on("close", () => {
        resolve(found)
      })
      rl.on("error", (err) => {
        reject(err)
      })
    })
  }

  async findFilesPathsContentMatch({
    cwd,
    glob,
    relative,
    search,
  }: {
    cwd?: string
    glob: Fs0.PathOrPaths
    relative?: string | false
    search: Fs0.StringMatchInput
  }) {
    const allPaths = await this.findFilesPaths({
      cwd,
      glob,
      relative,
    })
    const result = (
      await Promise.all(
        allPaths.map(async (path) => {
          if (await this.isContentMatch(path, search)) {
            return path
          }
          return null
        }),
      )
    ).filter(Boolean) as string[]
    return result
  }

  async ensureFilesPathsContentMatch({
    cwd,
    path,
    relative,
    search,
  }: {
    cwd?: string
    path: Fs0.PathOrPaths
    relative?: string | false
    search: Fs0.StringMatchInput
  }) {
    const allPaths = this.toPaths(path)
    const result = (
      await Promise.all(
        allPaths.map(async (path) => {
          if (await this.isContentMatch(path, search)) {
            return path
          }
          return null
        }),
      )
    ).filter(Boolean) as string[]
    return result
  }

  toAbs<T extends Fs0.PathOrPaths>(path: T, relativeToAbs: string = this.cwd): T {
    if (Array.isArray(path)) {
      return path.map((p) => this.toAbs(p)) as T
    }
    if (path.startsWith("!")) {
      const cutted = path.replace(/^!/, "")
      const result = this.toAbs(cutted, relativeToAbs)
      return `!${result}` as T
    }
    const pathNormalized = this.normalizePath(path)
    return nodePath.resolve(relativeToAbs, pathNormalized) as T
  }

  toRel<T extends Fs0.PathOrPaths>(path: T, relativeTo?: string, withLeadingDot?: boolean): T
  toRel<T extends Fs0.PathOrPaths>(path: T, withLeadingDot?: boolean, relativeTo?: string): T
  toRel<T extends Fs0.PathOrPaths>(path: T, first?: any, second?: any): T {
    const relativeTo = typeof first === "string" ? first : typeof second === "string" ? second : this.cwd
    const withLeadingDot = typeof first === "boolean" ? first : typeof second === "boolean" ? second : true
    if (Array.isArray(path)) {
      return path.map((p) => this.toRel(p)) as T
    }
    if (path.startsWith("!")) {
      const cutted = path.replace(/^!/, "")
      const result = this.toRel(cutted, first, second)
      return `!${result}` as T
    }
    const pathNormalized = this.normalizePath(path)
    const result = nodePath.relative(relativeTo, pathNormalized)
    if (withLeadingDot && !result.startsWith("../") && !result.startsWith("/") && !result.startsWith("./")) {
      return `./${result}` as T
    }
    return result as T
  }

  parsePath(path: string, relativeTo: string = this.rootDir) {
    const abs = this.toAbs(path)
    const rel = this.toRel(path, relativeTo, false)
    const relDotted = this.toRel(path, relativeTo, true)
    const extDotted = nodePath.extname(path)
    const ext = extDotted.replace(/^\./, "")
    const name = nodePath.basename(path)
    const basename = nodePath.basename(path, extDotted)
    const dir = nodePath.dirname(path)
    const dirname = nodePath.basename(dir)
    return { abs, rel, relDotted, name, ext, extDotted, basename, dir, dirname }
  }

  replaceExt(path: string, ext: string) {
    const originalExt = nodePath.extname(path)
    if (ext && !ext.startsWith(".")) {
      ext = `.${ext}`
    }
    return path.replace(new RegExp(`${originalExt}$`), ext)
  }

  writeFileSync(path: string, content: string, format: boolean = false) {
    fsSync.writeFileSync(this.normalizePath(path), content)
    if (format) {
      this.formatFileSync(path)
    }
  }
  async writeFile(path: string, content: string, format: boolean = false) {
    path = this.normalizePath(path)
    await fs.mkdir(nodePath.dirname(path), { recursive: true })
    await fs.writeFile(path, content)
    if (format) {
      await this.formatFile(path)
    }
  }

  static sortJson = <T>(content: T, sort: true | string[] | ((content: T) => string[]) = true): T => {
    if (!content || typeof content !== "object") return content

    // figure out keys order
    let keys: string[]
    if (sort === true) {
      keys = Object.keys(content).sort()
    } else if (Array.isArray(sort)) {
      keys = uniq([...sort.map((k) => k.split(".")[0]), ...Object.keys(content)])
    } else {
      keys = sort(content)
    }

    const result: Record<string, any> = {}

    for (const key of keys) {
      if (!(key in content)) continue

      const value = (content as Record<string, unknown>)[key]

      if (Array.isArray(sort)) {
        // find dotted keys for this property
        const dottedKeys = sort.filter((k) => k.startsWith(key + ".")).map((k) => k.slice(key.length + 1)) // cut off prefix "key."

        if (dottedKeys.length > 0 && typeof value === "object" && value !== null) {
          // recurse inside
          result[key] = Fs0.sortJson(value, dottedKeys)
          continue
        }
      }

      result[key] = value
    }

    return result as T
  }

  writeJsonSync<T>(
    path: string,
    content: T,
    sort: boolean | string[] | ((content: T) => string[]) = false,
    format: boolean = false,
  ) {
    const sortedContent = !sort ? content : Fs0.sortJson(content, sort)
    this.writeFileSync(path, CommentJson.stringify(sortedContent, null, 2), format)
  }
  async writeJson<T>(
    path: string,
    content: T,
    sort: boolean | string[] | ((content: T) => string[]) = false,
    format: boolean = false,
  ) {
    const sortedContent = !sort ? content : Fs0.sortJson(content, sort)
    await this.writeFile(path, CommentJson.stringify(sortedContent, null, 2), format)
  }

  formatFileSync(path: string) {
    path = this.normalizePath(path)
    return Formatter0.formatSync(path, this.formatCommand, this.cwd)
  }

  async formatFile(path: string) {
    path = this.normalizePath(path)
    return await Formatter0.format(path, this.formatCommand, this.cwd)
  }

  readFileSync(path: string) {
    return fsSync.readFileSync(this.normalizePath(path), "utf8")
  }

  async readFile(path: string) {
    return await fs.readFile(this.normalizePath(path), "utf8")
  }

  readJsonSync<T = any>(path: string) {
    return CommentJson.parse(this.readFileSync(path), null, true) as T
  }

  async readJson<T = any>(path: string) {
    return CommentJson.parse(await this.readFile(path), null, true) as T
  }

  resolve(...paths: string[]): string {
    paths = paths.map((path) => this.normalizePath(path))
    return nodePath.resolve(this.cwd, ...paths)
  }

  basename(path: string): string {
    return nodePath.basename(this.normalizePath(path))
  }

  basenameWithoutExt(path: string): string {
    return nodePath.basename(this.normalizePath(path), nodePath.extname(path))
  }

  isDirectorySync(path: string): boolean {
    try {
      return fsSync.statSync(this.toAbs(path)).isDirectory()
    } catch {
      return false
    }
  }

  async isDirectory(path: string): Promise<boolean> {
    try {
      return (await fs.stat(this.toAbs(path))).isDirectory()
    } catch {
      return false
    }
  }

  isFileSync(path: string): boolean {
    try {
      return fsSync.statSync(this.toAbs(path)).isFile()
    } catch {
      return false
    }
  }

  async isFile(path: string): Promise<boolean> {
    try {
      return (await fs.stat(this.toAbs(path))).isFile()
    } catch {
      return false
    }
  }

  isExistsSync(path: string): boolean {
    try {
      fsSync.statSync(this.toAbs(path))
      return true
    } catch {
      return false
    }
  }

  async isExists(path: string): Promise<boolean> {
    try {
      await fs.stat(this.toAbs(path))
      return true
    } catch {
      return false
    }
  }

  normalizePath(path: string): string {
    if (path.startsWith("!")) {
      const result = this.normalizePath(path.replace(/^!/, ""))
      return `!${result}`
    }
    if (/^~\//.test(path)) {
      return nodePath.resolve(this.rootDir, path.replace(/^~\//, ""))
    }
    if (/^~[a-zA-Z0-9_-]+/.test(path)) {
      return nodePath.resolve(this.rootDir, path.replace(/^~/, ""))
    }
    return path
  }

  toPaths(path: Fs0.PathOrPaths): string[] {
    return Array.isArray(path) ? path.map(this.normalizePath.bind(this)) : [this.normalizePath(path)]
  }

  isPathMatchGlob(path: string, glob: string | string[]): boolean {
    const pathNormalized = this.normalizePath(path)
    const globNormalized = Array.isArray(glob) ? glob.map(this.normalizePath.bind(this)) : [this.normalizePath(glob)]
    const negativeGlobs = globNormalized.filter((g) => g.startsWith("!")).map((g) => g.replace(/^!/, ""))
    const positiveGlobs = globNormalized.filter((g) => !g.startsWith("!"))
    const isMatchPositive = micromatch.isMatch(pathNormalized, positiveGlobs)
    const isMatchNegative = micromatch.isMatch(pathNormalized, negativeGlobs)
    return isMatchPositive && !isMatchNegative
  }

  isPathInDir(path: string, dir: string): boolean {
    const pathNormalized = this.toAbs(path)
    const dirNormalized = this.toAbs(dir)
    return pathNormalized.startsWith(dirNormalized) && pathNormalized !== dirNormalized
  }

  async findUp(filename: string | string[]): Promise<string | undefined> {
    return await findUp(filename, { cwd: this.cwd })
  }
  static async findUp(filename: string | string[], createFsInput?: Fs0.CreateFsInput) {
    const fs0 = Fs0.create(createFsInput)
    return await fs0.findUp(filename)
  }

  findUpSync(filename: string | string[]): string | undefined {
    return findUpSync(filename, { cwd: this.cwd })
  }
  static findUpSync(filename: string | string[], createFsInput?: Fs0.CreateFsInput) {
    const fs0 = Fs0.create(createFsInput)
    return fs0.findUpSync(filename)
  }

  async findUpFile(filename: string | string[]): Promise<File0 | undefined> {
    const path = await findUp(filename, { cwd: this.cwd })
    if (!path) {
      return undefined
    }
    return File0.create({ filePath: path, rootDir: this.rootDir })
  }
  static async findUpFile(filename: string | string[], createFsInput?: Fs0.CreateFsInput) {
    const fs0 = Fs0.create(createFsInput)
    return await fs0.findUpFile(filename)
  }

  findUpFileSync(filename: string): File0 | undefined {
    const path = findUpSync(filename, { cwd: this.cwd })
    if (!path) {
      return undefined
    }
    return File0.create({ filePath: path, rootDir: this.rootDir })
  }

  async loadEnv(filename: string = ".env"): Promise<Record<string, string>> {
    return dotenv.config({ path: await this.findUp(filename) }).parsed as Record<string, string>
  }

  loadEnvSync(filename: string = ".env"): Record<string, string> {
    return dotenv.config({ path: this.findUpSync(filename) }).parsed as Record<string, string>
  }

  async importFresh<T = any>(path: string): Promise<T> {
    path = this.toAbs(path)
    return await import(`${path}?t=${Date.now()}`)
  }

  async importFreshDefault<T = any>(path: string): Promise<T> {
    path = this.toAbs(path)
    return (await import(`${path}?t=${Date.now()}`).then((m) => m.default)) as T
  }

  async importFresh1<T = any>(path: string, alias?: Record<string, string>): Promise<T> {
    path = this.toAbs(path)
    const jiti = createJiti(import.meta.url, { alias })
    return await jiti.import(`${path}?t=${Date.now()}`)
  }

  async importFreshDefault1<T = any>(path: string, alias?: Record<string, string>): Promise<T> {
    path = this.toAbs(path)
    const jiti = createJiti(import.meta.url, { alias })
    return (await jiti.import(`${path}?t=${Date.now()}`, { default: true, ...alias })) as T
  }

  async rm(path: string) {
    try {
      await fs.rm(path)
    } catch {}
  }

  rmSync(path: string) {
    try {
      fsSync.rmSync(path)
    } catch {}
  }

  async rmdir(path: string) {
    try {
      await fs.rmdir(path, { recursive: true })
    } catch {}
  }

  rmdirSync(path: string) {
    try {
      fsSync.rmdirSync(path, { recursive: true })
    } catch {}
  }

  createFile0(filePath: string): File0 {
    filePath = this.toAbs(filePath)
    return File0.create({ filePath, rootDir: this.rootDir })
  }

  node = fs
  nodeSync = fsSync
}

export class File0 {
  path: Fs0.PathParsed
  fs0: Fs0

  private constructor({ filePath, fs0 }: { filePath: string; fs0: Fs0 }) {
    this.fs0 = fs0
    this.path = this.fs0.parsePath(filePath)
  }

  static create({ filePath, rootDir }: { filePath: string; rootDir?: string }): File0 {
    const fs0 = Fs0.create({
      filePath,
      rootDir,
    })
    return new File0({ filePath, fs0 })
  }

  setRootDir(rootDir: string) {
    this.fs0.setRootDir(rootDir)
    this.path = this.fs0.parsePath(this.path.abs)
  }
  setCwd(cwd: string) {
    this.fs0.setCwd(cwd)
    this.path = this.fs0.parsePath(this.path.abs)
  }

  isExistsSync() {
    return this.fs0.isExistsSync(this.path.abs)
  }
  async isExists() {
    return await this.fs0.isExists(this.path.abs)
  }

  writeSync(content: string, format: boolean = false) {
    return this.fs0.writeFileSync(this.path.abs, content, format)
  }

  async write(content: string, format: boolean = false) {
    return this.fs0.writeFile(this.path.abs, content, format)
  }

  writeJsonSync<T>(content: T, sort: boolean | string[] | ((content: T) => string[]) = false, format: boolean = false) {
    return this.fs0.writeJsonSync(this.path.abs, content, sort, format)
  }
  async writeJson<T>(
    content: T,
    sort: boolean | string[] | ((content: T) => string[]) = false,
    format: boolean = false,
  ) {
    return await this.fs0.writeJson(this.path.abs, content, sort, format)
  }

  formatSync() {
    return this.fs0.formatFileSync(this.path.abs)
  }

  async format() {
    return await this.fs0.formatFile(this.path.abs)
  }

  readSync() {
    return this.fs0.readFileSync(this.path.abs)
  }

  async read() {
    return await this.fs0.readFile(this.path.abs)
  }

  readJsonSync<T = any>() {
    return this.fs0.readJsonSync(this.path.abs) as T
  }

  async readJson<T = any>() {
    return (await this.fs0.readJson(this.path.abs)) as T
  }

  relToDir(file0: File0): string
  relToDir(fs0: Fs0): string
  relToDir(dir: string): string
  relToDir(input: string | File0 | Fs0) {
    const dir = typeof input === "string" ? input : input instanceof File0 ? input.path.dir : input.cwd
    const fs0 = this.fs0.createFs0({ cwd: dir })
    return fs0.toRel(this.path.abs)
  }

  async importFresh<T = any>(): Promise<T> {
    return await import(`${this.path.abs}?t=${Date.now()}`)
  }

  async importFreshDefault<T = any>(): Promise<T> {
    return (await import(`${this.path.abs}?t=${Date.now()}`).then((m) => m.default)) as T
  }

  async importFresh1<T = any>(alias?: Record<string, string>): Promise<T> {
    const jiti = createJiti(import.meta.url, { alias })
    return await jiti.import(`${this.path.abs}?t=${Date.now()}`)
  }

  async importFreshDefault1<T = any>(alias?: Record<string, string>): Promise<T> {
    const jiti = createJiti(import.meta.url, { alias })
    return (await jiti.import(`${this.path.abs}?t=${Date.now()}`, { default: true })) as T
  }

  async isContentMatch(search: Fs0.StringMatchInput) {
    return await this.fs0.isContentMatch(this.path.abs, search)
  }
}

export namespace Fs0 {
  export type CreateFsInput = { rootDir?: string; formatCommand?: string } & (
    | { fileDir?: string }
    | { filePath?: string }
    | { cwd?: string }
  )
  export type Path = string
  export type Paths = string[]
  export type PathOrPaths = Path | Paths
  export type PathParsed = ReturnType<typeof Fs0.prototype.parsePath>
  export type StringMatchInput = string | string[] | RegExp | RegExp[]
}

export class Formatter0 {
  fs0: Fs0
  tools: Formatter0.Tool[] = []
  biomeConfigFile0: File0 | undefined
  eslintConfigFile0: File0 | undefined
  prettierConfigFile0: File0 | undefined
  command: string | undefined

  static cache: Formatter0.CacheItem[] = []

  private constructor({
    tools,
    command,
    fs0,
    biomeConfigFile0,
    eslintConfigFile0,
    prettierConfigFile0,
  }: {
    tools: Formatter0.Tool[]
    command: string | undefined
    fs0: Fs0
    biomeConfigFile0: File0 | undefined
    eslintConfigFile0: File0 | undefined
    prettierConfigFile0: File0 | undefined
  }) {
    this.tools = tools
    this.command = command
    this.fs0 = fs0
    this.biomeConfigFile0 = biomeConfigFile0
    this.eslintConfigFile0 = eslintConfigFile0
    this.prettierConfigFile0 = prettierConfigFile0
  }

  static async create(props?: {
    command?: string | undefined
    cwd?: string | undefined
    fs0?: Fs0
  }): Promise<Formatter0> {
    const fs0 = props?.fs0 || Fs0.create({ cwd: props?.cwd })
    if (props?.command) {
      return new Formatter0({
        tools: [],
        command: props.command,
        fs0,
        biomeConfigFile0: undefined,
        eslintConfigFile0: undefined,
        prettierConfigFile0: undefined,
      })
    } else {
      const { tools, biomeConfigFile0, eslintConfigFile0, prettierConfigFile0 } = await Formatter0.detectTools({ fs0 })
      return new Formatter0({
        tools,
        command: props?.command,
        fs0,
        biomeConfigFile0,
        eslintConfigFile0,
        prettierConfigFile0,
      })
    }
  }

  static createByCommand(props: { command: string | undefined; cwd?: string | undefined; fs0?: Fs0 }): Formatter0 {
    const fs0 = props?.fs0 || Fs0.create({ cwd: props?.cwd })
    return new Formatter0({
      tools: [],
      command: props.command,
      fs0,
      biomeConfigFile0: undefined,
      eslintConfigFile0: undefined,
      prettierConfigFile0: undefined,
    })
  }

  static async detectTools({ fs0 }: { fs0: Fs0 }): Promise<{
    tools: Formatter0.Tool[]
    biomeConfigFile0: File0 | undefined
    eslintConfigFile0: File0 | undefined
    prettierConfigFile0: File0 | undefined
  }> {
    const cwd = fs0.cwd
    for (const cacheItem of Formatter0.cache) {
      if (cacheItem.cwd === cwd) {
        return cacheItem.formatter0
      }
    }
    const tools: Formatter0.Tool[] = []

    const biomeConfigFile0 = await fs0.findUpFile(["biome.json", "biome.jsonc"])
    if (biomeConfigFile0) {
      tools.push("biome")
    }
    const eslintConfigFile0 = await fs0.findUpFile([
      "eslint.config.js",
      "eslint.config.ts",
      "eslint.config.json",
      "eslint.config.mjs",
      "eslint.config.cjs",
    ])
    if (eslintConfigFile0) {
      tools.push("eslint")
    }
    const prettierConfigFile0 = await fs0.findUpFile([
      "prettier.config.js",
      "prettier.config.ts",
      "prettier.config.json",
      "prettier.config.mjs",
      "prettier.config.cjs",
    ])
    if (prettierConfigFile0) {
      tools.push("prettier")
    }
    return { tools, biomeConfigFile0, eslintConfigFile0, prettierConfigFile0 }
  }

  getPathsString(paths: Fs0.PathOrPaths) {
    return Array.isArray(paths) ? paths.join(" ") : paths
  }
  getCustomCommand(paths: Fs0.PathOrPaths) {
    if (!this.command) {
      throw new Error("Command is not set")
    }
    if (this.command.includes("{{paths}}")) {
      return this.command.replaceAll("{{paths}}", this.getPathsString(paths))
    }
    return `${this.command} ${this.getPathsString(paths)}`
  }
  getBiomeCommand(paths: Fs0.PathOrPaths) {
    return `biome format --write ${this.getPathsString(paths)}`
  }
  getEslintCommand(paths: Fs0.PathOrPaths) {
    return `eslint --fix ${this.getPathsString(paths)}`
  }
  getPrettierCommand(paths: Fs0.PathOrPaths) {
    return `prettier --write ${this.getPathsString(paths)}`
  }
  getSequenceCommand(commands: string[]) {
    return commands.join(" && ")
  }
  getParallelCommand(commands: string[]) {
    return commands.join(" & ")
  }
  getFullSequenceCommand(paths: Fs0.PathOrPaths) {
    if (this.command) {
      return this.getCustomCommand(paths)
    }
    const commands: string[] = []
    if (this.tools.includes("biome")) {
      commands.push(this.getBiomeCommand(paths))
    }
    if (this.tools.includes("eslint")) {
      commands.push(this.getEslintCommand(paths))
    }
    if (this.tools.includes("prettier")) {
      commands.push(this.getPrettierCommand(paths))
    }
    return this.getSequenceCommand(commands)
  }
  getFullParallelCommand(paths: Fs0.PathOrPaths) {
    if (this.command) {
      return this.getCustomCommand(paths)
    }
    const commands: string[] = []
    if (this.tools.includes("biome")) {
      commands.push(this.getBiomeCommand(paths))
    }
    if (this.tools.includes("eslint")) {
      commands.push(this.getEslintCommand(paths))
    }
    if (this.tools.includes("prettier")) {
      commands.push(this.getPrettierCommand(paths))
    }
    return this.getParallelCommand(commands)
  }

  static formatSync(paths: Fs0.PathOrPaths, command?: string, fs0?: Fs0): ReturnType<typeof execSync>
  static formatSync(paths: Fs0.PathOrPaths, command?: string, cwd?: string): ReturnType<typeof execSync>
  static formatSync(paths: Fs0.PathOrPaths, command?: string, cwdOrFs0?: string | Fs0) {
    const fs0 = cwdOrFs0 instanceof Fs0 ? cwdOrFs0 : undefined
    const cwd = typeof cwdOrFs0 === "string" ? cwdOrFs0 : undefined
    const formatter0 = Formatter0.createByCommand({ command, cwd, fs0 })
    return formatter0.formatSync(paths)
  }
  formatSync(paths: Fs0.PathOrPaths) {
    const command = this.getFullSequenceCommand(paths)
    return execSync(command, { stdio: "inherit", cwd: this.fs0.cwd })
  }

  static async format(paths: Fs0.PathOrPaths, command?: string, fs0?: Fs0): Promise<ReturnType<typeof exec>>
  static async format(paths: Fs0.PathOrPaths, command?: string, cwd?: string): Promise<ReturnType<typeof exec>>
  static async format(
    paths: Fs0.PathOrPaths,
    command?: string,
    cwdOrFs0?: string | Fs0,
  ): Promise<ReturnType<typeof exec>> {
    const fs0 = cwdOrFs0 instanceof Fs0 ? cwdOrFs0 : undefined
    const cwd = typeof cwdOrFs0 === "string" ? cwdOrFs0 : undefined
    const formatter0 = await Formatter0.create({ command, cwd, fs0 })
    return await formatter0.format(paths)
  }
  async format(paths: Fs0.PathOrPaths) {
    const command = this.getFullParallelCommand(paths)
    return await exec(command, { cwd: this.fs0.cwd })
  }
}

export namespace Formatter0 {
  export type Tool = "biome" | "eslint" | "prettier"
  export type CacheItem = {
    cwd: string
    formatter0: Formatter0
  }
}
