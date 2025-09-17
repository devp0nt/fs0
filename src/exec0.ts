import nodePath from 'node:path'
import chalk from 'chalk'
import { type ResultPromise as ExecaReturnValue, execa } from 'execa'

export namespace Exec0 {
  export type CommandOrParts = string | string[]
  export type CommandOrCommands = string | string[] | string[][]
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
    silent?: boolean
    colors?: boolean
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
    command: CommandOrCommands
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
  export type CreateInput = {
    normalizeCwd?: Exec0.NormalizeCwd
    prefixSuffix?: string
    fixPrefixesLength?: boolean
    preferLocal?: boolean
    resolveOnNonZeroExit?: boolean
    interactive?: boolean | 'tee'
    silent?: boolean
    colors?: boolean | undefined
    env?: NodeJS.ProcessEnv
    commandPrefix?: string | string[] | null
    commandWrapper?: string | null
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
  preferLocal: boolean
  resolveOnNonZeroExit: boolean
  interactive: boolean | 'tee'
  silent: boolean
  colors: boolean | null
  env: NodeJS.ProcessEnv
  commandPrefix: string | string[] | null
  commandWrapper: string | null

  private constructor({
    normalizeCwd,
    prefixSuffix,
    fixPrefixesLength,
    preferLocal,
    resolveOnNonZeroExit,
    interactive,
    silent,
    colors,
    env,
    commandPrefix,
    commandWrapper,
  }: {
    normalizeCwd: Exec0.NormalizeCwd
    prefixSuffix: string
    fixPrefixesLength: boolean
    preferLocal: boolean
    resolveOnNonZeroExit: boolean
    interactive: boolean | 'tee'
    silent: boolean
    colors: boolean | null
    env: NodeJS.ProcessEnv
    commandPrefix: string | string[] | null
    commandWrapper: string | null
  }) {
    this.normalizeCwd = normalizeCwd
    this.prefixSuffix = prefixSuffix
    this.fixPrefixesLength = fixPrefixesLength
    this.preferLocal = preferLocal
    this.resolveOnNonZeroExit = resolveOnNonZeroExit
    this.interactive = interactive
    this.silent = silent
    this.colors = colors
    this.env = env
    this.commandPrefix = commandPrefix
    this.commandWrapper = commandWrapper
  }

  static create({
    normalizeCwd,
    prefixSuffix,
    fixPrefixesLength,
    preferLocal,
    resolveOnNonZeroExit,
    interactive,
    silent,
    colors,
    env,
    commandPrefix,
    commandWrapper,
  }: Exec0.CreateInput = {}): Exec0 {
    return new Exec0({
      normalizeCwd: normalizeCwd ?? ((cwd) => cwd),
      prefixSuffix: prefixSuffix ?? ' | ',
      fixPrefixesLength: fixPrefixesLength ?? true,
      preferLocal: preferLocal ?? false,
      resolveOnNonZeroExit: resolveOnNonZeroExit ?? false,
      interactive: interactive ?? 'tee',
      silent: silent ?? false,
      colors: colors ?? true,
      env: env ?? {},
      commandPrefix: commandPrefix ?? null,
      commandWrapper: commandWrapper ?? null,
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
      interactive = this.interactive,
      silent = this.silent,
      colors = this.colors,
      timeoutMs,
      resolveOnNonZeroExit = this.resolveOnNonZeroExit,
      preferLocal = this.preferLocal,
      prefix,
      prefixSuffix = this.prefixSuffix,
    } = options
    const commandPefixed = (() => {
      const original = options.command
      const commandPrefix = this.commandPrefix
      if (typeof commandPrefix === 'string' && typeof original === 'string') {
        return `${commandPrefix} ${original}`
      } else if (typeof commandPrefix === 'string' && Array.isArray(original)) {
        return `${commandPrefix} ${original.join(' ')}`
      } else if (Array.isArray(commandPrefix) && typeof original === 'string') {
        return [...commandPrefix, original]
      } else if (Array.isArray(commandPrefix) && Array.isArray(original)) {
        return [...commandPrefix, ...original]
      } else {
        return original
      }
    })()
    const command = (() => {
      if (!this.commandWrapper) {
        return commandPefixed
      } else {
        // TODO: make it normal, it is very bad
        const commandStr = typeof commandPefixed === 'string' ? commandPefixed : commandPefixed.join(' ')

        // Check if wrapper uses {{command}} or {{commandEscaped}} placeholders
        if (this.commandWrapper.includes('{{commandEscaped}}')) {
          // For complex escaping, use the old method
          function bashEscape(command: string): string {
            return (
              command
                // escape double quotes, backslashes, $, `
                .replace(/(["\\$`])/g, '\\$1')
                // escape single quotes safely for double-quoted wrapper
                .replace(/'/g, `'"'"'`)
            )
          }
          const commandEscaped = bashEscape(commandStr)
          return this.commandWrapper.replaceAll('{{commandEscaped}}', commandEscaped)
        } else if (this.commandWrapper.includes('{{command}}')) {
          // For simple replacement, just replace without escaping
          return this.commandWrapper.replaceAll('{{command}}', commandStr)
        } else {
          // If no placeholders, treat as prefix and append command
          return [this.commandWrapper, commandStr]
        }
      }
    })()
    const cwd = this.normalizeCwd(options.cwd ?? process.cwd())
    // biome-ignore lint/suspicious/noConsole: <it os ok>
    const log = silent ? () => {} : (options.log ?? console.log)
    const env = {
      ...this.env,
      ...options.env,
    }

    const colorsEnv =
      colors === true
        ? {
            FORCE_COLOR: '3',
            COLORTERM: 'truecolor',
            NO_COLOR: undefined as any,
          }
        : colors === false
          ? {
              FORCE_COLOR: undefined as any,
              COLORTERM: undefined as any,
              NO_COLOR: '1',
            }
          : {}

    const envForced = {
      ...process.env,
      ...colorsEnv,
      ...env,
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
        const res = finalize(
          r.exitCode ?? 0,
          r.stdout ?? '',
          r.stderr ?? '',
          [r.stdout, r.stderr].filter(Boolean).join(),
        )
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
        const res = finalize(
          r.exitCode ?? 0,
          r.stdout ?? '',
          r.stderr ?? '',
          [r.stdout, r.stderr].filter(Boolean).join(),
        )
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
    command: Exec0.CommandOrCommands,
    options?: Omit<Exec0.ManyOptions, 'command'>,
  ): Promise<Exec0.ExecResult[]>
  static async many(
    command: Exec0.CommandOrCommands,
    cwd?: Exec0.CwdOrCwds,
    options?: Omit<Exec0.ManyOptions, 'command' | 'cwd'>,
  ): Promise<Exec0.ExecResult[]>
  static async many(
    command: Exec0.CommandOrCommands,
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
    command: Exec0.CommandOrCommands,
    options?: Omit<Exec0.ManyOptions, 'command'>,
  ): Promise<Exec0.ExecResult[]>
  async many(
    command: Exec0.CommandOrCommands,
    cwd?: Exec0.CwdOrCwds,
    options?: Omit<Exec0.ManyOptions, 'command' | 'cwd'>,
  ): Promise<Exec0.ExecResult[]>
  async many(
    command: Exec0.CommandOrCommands,
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
      options: optionsArray,
      fixPrefixesLength = this.fixPrefixesLength,
      ...rest
    } = Exec0.normalizeManyOptions(args)
    // console.log('many', { command, cwd, names, parallel, options, ...rest })
    const execOneOptions = (() => {
      if (optionsArray) {
        return optionsArray.map((options, index) => {
          const cwd = options.cwd || process.cwd()
          const cwdDirname = nodePath.basename(cwd)
          const prefix =
            options.prefix ??
            rest.prefix ??
            (Array.isArray(names) ? names[index] : names === true ? cwdDirname : undefined)
          return { ...rest, ...options, prefix }
        })
      } else {
        const cwds = cwd === undefined ? [process.cwd()] : Array.isArray(cwd) ? cwd : [cwd]
        const commands = typeof command === 'string' ? [command] : command
        if (isArrayOfStrings(commands)) {
          return cwds.map((cwd, cwdIndex) => {
            const cwdDirname = nodePath.basename(cwd)
            const prefix = Array.isArray(names) ? names[cwdIndex] : names === true ? cwdDirname : undefined
            return { ...rest, command, cwd, prefix }
          })
        } else {
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
      return await Promise.all(execOneOptions.map((options) => this.one(options)))
    }
    const results: Exec0.ExecResult[] = []
    for (const options of execOneOptions) {
      results.push(await this.one(options))
    }
    return results
  }
}
