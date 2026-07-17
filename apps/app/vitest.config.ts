import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    environment: "jsdom",
    include: ["src/**/*.test.ts", "src/**/*.test.tsx"],
    setupFiles: ["src/test/setup.ts"],
    coverage: {
      provider: "v8",
      reporter: ["text", "json-summary", "lcov", "html"],
      reportsDirectory: "coverage/ts",
      // `include` also collects matching files that no test imports.
      include: ["src/lib/**/*.ts", "src/components/**/*.{ts,tsx}", "src/routes/**/*.{ts,tsx}"],
      exclude: [
        // Tests are not production code.
        "**/*.test.*",
        // Declaration files contain no executable application behavior.
        "**/*.d.ts",
        // Barrel exports only re-export behavior that is measured at its source.
        "**/index.ts",
        // Type-only modules contain no runtime behavior.
        "**/types.ts",
        // This setup code supports tests rather than application behavior.
        "src/test/**",
        // CSS declarations and modules are not TypeScript production behavior.
        "**/*.module.css",
        // Vite's framework bootstrap is outside the app behavior scope.
        "src/main.tsx",
      ],
    },
  },
});
