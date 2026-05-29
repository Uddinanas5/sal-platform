import { defineConfig } from "vitest/config"
import tsconfigPaths from "vite-tsconfig-paths"

// Test harness for SAL. Node environment — these are server/logic unit tests,
// not DOM/component tests. Path aliases (@/...) come from tsconfig via the
// vite-tsconfig-paths plugin so test imports match app imports exactly.
export default defineConfig({
  plugins: [tsconfigPaths()],
  test: {
    environment: "node",
    include: ["tests/**/*.test.ts"],
    globals: true,
  },
})
