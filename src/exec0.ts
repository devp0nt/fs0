import nodePath from 'node:path'
import chalk from 'chalk'
import { type ResultPromise as ExecaReturnValue, execa } from 'execa'

export namespace Exec0 {
  export type CommandOrParts = string | string[]
  export type StrCommandOrCommands = string | string[]
  export type Cwd = string
  export type CwdOrCwds = string | string[]
  export type NormalizeCwd = (cwd: Cwd) => string
  export type Options = {
    command: CommandOrParts
    cwd?: Cwd
    /**
     * true  -> fully interactive TTY (best colors/UX, cannot capture programmatically)
     * 'tee' -> show live output AND capture it (stdin attached)  <-- default for sequential
     * false -> capture silently (stdin closed)
     */
    interactive?: boolean | 'tee'
    env?: NodeJS.ProcessEnv
    timeoutMs?: number
    log?: (...args: any[]) => void
    /** Resolve with results even on non-zero exit? default false (reject on non-zero) */
    resolveOnNonZeroExit?: boolean
    /** Prefer local binaries in node_modules/.bin (default true) */
    preferLocal?: boolean
    /** Add a colored prefix before each log line (e.g. the cwd) */
    prefix?: string
    prefixSuffix?: string
  }
  export type ManyOptions = {
    command: StrCommandOrCommands
    cwd?: CwdOrCwds
    parallel?: boolean
    names?: string[] | boolean
    options?: Options[]
    fixPrefixesLength?: boolean
  } & Omit<Options, 'command' | 'cwd'>
  export type ExecResult = {
    cwd: string
    command: string
    code: number
    stdout: string
    stderr: string
    output: string
    durationMs: number
  }
}

const isString = (x: any): x is string => typeof x === 'string'
const isArrayOfStrings = (x: any): x is string[] => Array.isArray(x) && x.every((y) => typeof y === 'string')
const isStringOrArrayOfStrings = (x: any): x is string | string[] => typeof x === 'string' || isArrayOfStrings(x)
const isOptions = (x: any): x is Exec0.Options => typeof x === 'object' && !Array.isArray(x)
const isArrayOfOptions = (x: any): x is Exec0.Options[] => Array.isArray(x) && x.every((y) => isOptions(y))
const isBoolean = (x: any): x is boolean => typeof x === 'boolean'
const isUndefined = (x: any): x is undefined => x === undefined

export class Exec0 {
  normalizeCwd: Exec0.NormalizeCwd
  prefixSuffix: string
  fixPrefixesLength: boolean

  private constructor({
    normalizeCwd,
    prefixSuffix,
    fixPrefixesLength,
  }: { normalizeCwd: Exec0.NormalizeCwd; prefixSuffix: string; fixPrefixesLength: boolean }) {
    this.normalizeCwd = normalizeCwd
    this.prefixSuffix = prefixSuffix
    this.fixPrefixesLength = fixPrefixesLength
  }

  static create({
    normalizeCwd,
    prefixSuffix,
    fixPrefixesLength,
  }: {
    normalizeCwd?: Exec0.NormalizeCwd
    prefixSuffix?: string
    fixPrefixesLength?: boolean
  } = {}): Exec0 {
    return new Exec0({
      normalizeCwd: normalizeCwd ?? ((cwd) => cwd),
      prefixSuffix: prefixSuffix ?? ' | ',
      fixPrefixesLength: fixPrefixesLength ?? true,
    })
  }

  static normalizeOneOptions(args: any[]): Exec0.Options {
    if (args.length === 0) {
      throw new Error('No command provided')
    }
    const options = {} as Exec0.Options
    if (isOptions(args[0])) {
      Object.assign(options, args[0])
    } else if (isString(args[0])) {
      options.command = args[0]
    } else {
      throw new Error('Invalid first argument')
    }
    if (args.length === 1) {
      return options
    }
    if (isString(args[1])) {
      options.cwd = args[1]
    } else if (isOptions(args[1])) {
      Object.assign(options, args[1])
    } else if (isUndefined(args[1])) {
      options.cwd = args[1]
    } else {
      throw new Error('Invalid second argument')
    }
    if (args.length === 2) {
      return options
    }
    if (isOptions(args[2])) {
      Object.assign(options, args[2])
    } else if (isUndefined(args[2])) {
      // undefined options
    } else {
      throw new Error('Invalid third argument')
    }
    return options
  }

  static async one(command: Exec0.CommandOrParts, options?: Omit<Exec0.Options, 'command'>): Promise<Exec0.ExecResult>
  static async one(
    command: Exec0.CommandOrParts,
    cwd?: Exec0.Cwd,
    options?: Omit<Exec0.Options, 'command' | 'cwd'>,
  ): Promise<Exec0.ExecResult>
  static async one(options: Omit<Exec0.Options, 'command' | 'cwd'>): Promise<Exec0.ExecResult>
  static async one(...args: [any, ...any[]]): Promise<Exec0.ExecResult> {
    const exec0 = Exec0.create()
    return await exec0.one(...args)
  }

  async one(command: Exec0.CommandOrParts, options?: Omit<Exec0.Options, 'command'>): Promise<Exec0.ExecResult>
  async one(
    command: Exec0.CommandOrParts,
    cwd?: Exec0.Cwd,
    options?: Omit<Exec0.Options, 'command' | 'cwd'>,
  ): Promise<Exec0.ExecResult>
  async one(options: Omit<Exec0.Options, 'command' | 'cwd'>): Promise<Exec0.ExecResult>
  async one(...args: [any, ...any[]]): Promise<Exec0.ExecResult> {
    const options = Exec0.normalizeOneOptions(args)
    const {
      interactive = 'tee',
      env,
      timeoutMs,
      // biome-ignore lint/suspicious/noConsole: <it os ok>
      log = console.log,
      resolveOnNonZeroExit = false,
      preferLocal = true,
      prefix,
      command,
      prefixSuffix = this.prefixSuffix,
    } = options
    const cwd = this.normalizeCwd(options.cwd ?? process.cwd())

    const envForced = {
      ...process.env,
      ...env,
      FORCE_COLOR: env?.FORCE_COLOR ?? '3',
      COLORTERM: env?.COLORTERM ?? 'truecolor',
      NO_COLOR: undefined as any,
    }
    const cmdStr = typeof command === 'string' ? command : command.join(' ')
    const label = prefix ? chalk.bold(`${prefix}${prefixSuffix}`) : ''
    log(`${label}${chalk.gray(cwd)} ${chalk.bold('$')} ${chalk.cyan(cmdStr)}`)

    const started = Date.now()

    const common = {
      cwd,
      env: envForced,
      timeout: timeoutMs,
      preferLocal,
      reject: false as const, // we’ll handle exit codes ourselves
    }

    // Helper to return consistent shape
    const finalize = (code: number, stdout: string, stderr: string, output: string): Exec0.ExecResult => ({
      cwd,
      command: cmdStr,
      code,
      stdout,
      stderr,
      output,
      durationMs: Date.now() - started,
    })

    const teeAndCapture = async (
      child: ExecaReturnValue,
      cmdStr: string,
      log: (...args: any[]) => void,
      finalize: (code: number, stdout: string, stderr: string, output: string) => Exec0.ExecResult,
      resolveOnNonZeroExit: boolean,
    ): Promise<Exec0.ExecResult> => {
      let out = ''
      let err = ''
      let output = ''

      const makeLinePrefixer = (dest: NodeJS.WriteStream, label: string | undefined) => {
        const lbl = label ?? ''
        // biome-ignore lint/correctness/noUnusedVariables: <biome bug>
        let buf = ''
        const push = (s: string, final = false) => {
          // keep capture exact, but for display normalize CR -> NL so we break lines nicely
          buf += s
          let work = s.replace(/\r(?!\n)/g, '\n')
          let idx: number
          // biome-ignore lint/suspicious/noAssignInExpressions: <ok>
          while ((idx = work.indexOf('\n')) !== -1) {
            const seg = work.slice(0, idx) // completed line (no trailing \n)
            dest.write(lbl + seg + '\n')
            work = work.slice(idx + 1)
          }
          // if final, flush any remainder as a full line to avoid label-collision with next writer
          if (final && work.length) {
            dest.write(lbl + work + '\n')
          }
        }
        const end = () => push('', true)
        return { push, end }
      }

      const stdoutWriter = makeLinePrefixer(process.stdout, label)
      const stderrWriter = makeLinePrefixer(process.stderr, label)

      child.stdout?.on('data', (chunk: Buffer | string) => {
        const s = typeof chunk === 'string' ? chunk : chunk.toString()
        out += s
        output += s
        stdoutWriter.push(s)
      })
      child.stderr?.on('data', (chunk: Buffer | string) => {
        const s = typeof chunk === 'string' ? chunk : chunk.toString()
        err += s
        output += s
        stderrWriter.push(s)
      })
      child.stdout?.on('end', stdoutWriter.end)
      child.stderr?.on('end', stderrWriter.end)
      child.stdout?.on('close', stdoutWriter.end)
      child.stderr?.on('close', stderrWriter.end)

      const r = await child
      const res = finalize(r.exitCode ?? 0, out, err, output)
      if (r.exitCode !== 0 && !resolveOnNonZeroExit) {
        throw new Error(`Command failed: ${cmdStr} (code ${r.exitCode})`)
      }
      return res
    }

    try {
      if (typeof command === 'string') {
        // Use the user's shell so strings can include pipes/redirects
        if (interactive === true) {
          // const r = await execaCommand(cmdStr, { ...common, stdio: 'inherit' })
          const r = await execa(cmdStr, { ...common, shell: true, stdio: 'inherit' })
          const res = finalize(r.exitCode ?? 0, '', '', '')
          if (r.exitCode === 0) log(chalk.green('✓'), chalk.gray(`${res.durationMs}ms`))
          else log(chalk.red('✗'), `code ${r.exitCode}`)
          if (!resolveOnNonZeroExit && r.exitCode !== 0)
            throw new Error(`Command failed: ${cmdStr} (code ${r.exitCode})`)
          return res
        }

        if (interactive === 'tee') {
          // const child = execaCommand(cmdStr, { ...common, stdio: ['inherit', 'pipe', 'pipe'] })
          const child = execa(cmdStr, { ...common, shell: true, stdio: ['inherit', 'pipe', 'pipe'] })
          return await teeAndCapture(child, cmdStr, log, finalize, resolveOnNonZeroExit)
        }

        // interactive === false (silent capture)
        // const r = await execaCommand(cmdStr, { ...common })
        const r = await execa(cmdStr, { ...common, shell: true, stripFinalNewline: false })
        // execa returns stdout/stderr strings by default
        const res = finalize(r.exitCode ?? 0, r.stdout ?? '', r.stderr ?? '', '')
        if (r.exitCode === 0) log(chalk.green('✓'), chalk.gray(`${res.durationMs}ms`))
        else log(chalk.red('✗'), `code ${r.exitCode}`)
        if (!resolveOnNonZeroExit && r.exitCode !== 0) throw new Error(`Command failed: ${cmdStr} (code ${r.exitCode})`)
        return res
      } else {
        // Array form: [bin, ...args] (no shell; safest for args)
        const [file, ...args] = command
        if (interactive === true) {
          const r = await execa(file as string, args as string[], { ...common, stdio: 'inherit' })
          const res = finalize(r.exitCode ?? 0, '', '', '')
          if (r.exitCode === 0) log(chalk.green('✓'), chalk.gray(`${res.durationMs}ms`))
          else log(chalk.red('✗'), `code ${r.exitCode}`)
          if (!resolveOnNonZeroExit && r.exitCode !== 0) throw new Error(`Command failed: ${file} (code ${r.exitCode})`)
          return res
        }

        if (interactive === 'tee') {
          const child = execa(file as string, args as string[], { ...common, stdio: ['inherit', 'pipe', 'pipe'] })
          return await teeAndCapture(child, cmdStr, log, finalize, resolveOnNonZeroExit)
        }

        const r = await execa(file as string, args as string[], { ...common })
        const res = finalize(r.exitCode ?? 0, r.stdout ?? '', r.stderr ?? '', '')
        if (r.exitCode === 0) log(chalk.green('✓'), chalk.gray(`${res.durationMs}ms`))
        else log(chalk.red('✗'), `code ${r.exitCode}`)
        if (!resolveOnNonZeroExit && r.exitCode !== 0) throw new Error(`Command failed: ${file} (code ${r.exitCode})`)
        return res
      }
    } catch (err: any) {
      // (In practice, we usually won’t get here because reject:false)
      log(chalk.red('✗'), err?.message ?? err)
      throw err
    }
  }

  static normalizeManyOptions(args: any[]): Exec0.ManyOptions {
    if (args.length === 0) {
      throw new Error('No command provided')
    }
    const options = {} as Exec0.ManyOptions
    if (isOptions(args[0])) {
      Object.assign(options, args[0])
    } else if (isArrayOfOptions(args[0])) {
      options.options = args[0]
    } else if (isStringOrArrayOfStrings(args[0])) {
      options.command = args[0]
    } else {
      throw new Error('Invalid first argument')
    }
    if (args.length === 1) {
      return options
    }
    if (isStringOrArrayOfStrings(args[1])) {
      options.cwd = args[1]
    } else if (isUndefined(args[1])) {
      options.cwd = args[1]
    } else if (isOptions(args[1])) {
      Object.assign(options, args[1])
    } else {
      throw new Error('Invalid second argument')
    }
    if (args.length === 2) {
      return options
    }
    if (isArrayOfStrings(args[2])) {
      options.names = args[2]
    } else if (isBoolean(args[2])) {
      options.names = args[2]
    } else if (isUndefined(args[2])) {
      options.names = args[2]
    } else if (isOptions(args[2])) {
      Object.assign(options, args[2])
    } else {
      throw new Error('Invalid third argument')
    }
    if (isOptions(args[3])) {
      Object.assign(options, args[3])
    } else if (isUndefined(args[3])) {
      // undefined options
    } else {
      throw new Error('Invalid fourth argument')
    }
    return options
  }

  static async many(
    command: Exec0.StrCommandOrCommands,
    options?: Omit<Exec0.ManyOptions, 'command'>,
  ): Promise<Exec0.ExecResult[]>
  static async many(
    command: Exec0.StrCommandOrCommands,
    cwd?: Exec0.CwdOrCwds,
    options?: Omit<Exec0.ManyOptions, 'command' | 'cwd'>,
  ): Promise<Exec0.ExecResult[]>
  static async many(
    command: Exec0.StrCommandOrCommands,
    cwd?: Exec0.CwdOrCwds,
    names?: string[] | null,
    options?: Omit<Exec0.ManyOptions, 'command' | 'cwd'>,
  ): Promise<Exec0.ExecResult[]>
  static async many(optionsArray: Exec0.Options[]): Promise<Exec0.ExecResult[]>
  static async many(options: Exec0.ManyOptions): Promise<Exec0.ExecResult[]>
  static async many(...args: [any, ...any[]]): Promise<Exec0.ExecResult[]> {
    const exec0 = Exec0.create()
    return await exec0.many(...args)
  }

  async many(
    command: Exec0.StrCommandOrCommands,
    options?: Omit<Exec0.ManyOptions, 'command'>,
  ): Promise<Exec0.ExecResult[]>
  async many(
    command: Exec0.StrCommandOrCommands,
    cwd?: Exec0.CwdOrCwds,
    options?: Omit<Exec0.ManyOptions, 'command' | 'cwd'>,
  ): Promise<Exec0.ExecResult[]>
  async many(
    command: Exec0.StrCommandOrCommands,
    cwd?: Exec0.CwdOrCwds,
    names?: string[] | null,
    options?: Omit<Exec0.ManyOptions, 'command' | 'cwd'>,
  ): Promise<Exec0.ExecResult[]>
  async many(optionsArray: Exec0.Options[]): Promise<Exec0.ExecResult[]>
  async many(options: Exec0.ManyOptions): Promise<Exec0.ExecResult[]>
  async many(...args: any[]): Promise<Exec0.ExecResult[]> {
    const {
      command,
      cwd,
      names,
      parallel,
      options,
      fixPrefixesLength = this.fixPrefixesLength,
      ...rest
    } = Exec0.normalizeManyOptions(args)
    // console.log('many', { command, cwd, names, parallel, options, ...rest })
    const execOneOptions = (() => {
      if (options) {
        return options
      } else {
        const cwds = cwd === undefined ? [process.cwd()] : Array.isArray(cwd) ? cwd : [cwd]
        const commands = typeof command === 'string' ? [command] : command
        return cwds.flatMap((cwd, cwdIndex) =>
          commands.map((command, commandIndex) => {
            const optionIndex = cwdIndex * commands.length + commandIndex
            const cwdDirname = nodePath.basename(cwd)
            const prefixSuffix = commands.length ? `.${commandIndex}` : ''
            const prefix = Array.isArray(names)
              ? names[optionIndex]
              : names === true
                ? `${cwdDirname}${prefixSuffix}`
                : undefined
            return { ...rest, command, cwd, prefix }
          }),
        )
      }
    })()

    const prefixes = execOneOptions.map((options) => options.prefix)
    if (typeof prefixes[0] === 'string' && fixPrefixesLength) {
      const longestPrefix = prefixes.reduce((max, prefix) => Math.max(max, prefix?.length ?? 0), 0)
      for (const options of execOneOptions) {
        options.prefix = options.prefix?.padEnd(longestPrefix, ' ')
      }
    }

    if (parallel) {
      return await Promise.all(execOneOptions.map((options) => Exec0.one(options)))
    }
    const results: Exec0.ExecResult[] = []
    for (const options of execOneOptions) {
      results.push(await Exec0.one(options))
    }
    return results
  }
}
