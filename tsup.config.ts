import { readFileSync } from "node:fs"
import { defineConfig } from "tsup"

/**
 * Helper function to get external dependencies
 * This automatically reads from package.json and handles Node.js built-ins
 */
function getExternalDependencies() {
  const pkg = JSON.parse(readFileSync("package.json", "utf8"))

  // Node.js built-ins that should always be external
  const nodeBuiltins = ["node:child_process", "node:fs", "node:fs/promises", "node:path", "node:readline"]

  // Get all dependencies (runtime)
  const dependencies = Object.keys(pkg.dependencies || {})

  // Get dev dependencies that might be imported (exclude type definitions)
  const devDependencies = Object.keys(pkg.devDependencies || {}).filter((dep) => !dep.startsWith("@types/"))

  return [...nodeBuiltins, ...dependencies, ...devDependencies]
}

export default defineConfig({
  entry: ["src/index.ts"],
  format: ["cjs", "esm"],
  dts: true,
  splitting: false,
  sourcemap: true,
  clean: true,
  minify: false,
  target: "es2022",
  outDir: "dist",
  outExtension({ format }) {
    return {
      js: format === "cjs" ? ".cjs" : ".js",
    }
  },
  external: getExternalDependencies(),
  treeshake: true,
  bundle: true,
  platform: "node",
  tsconfig: "./tsconfig.build.json",
})
