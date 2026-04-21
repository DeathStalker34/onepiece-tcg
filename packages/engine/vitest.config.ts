import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    environment: 'node',
    include: ['tests/**/*.test.ts'],
    coverage: {
      provider: 'v8',
      reporter: ['text', 'html'],
      include: ['src/**/*.ts'],
      // Type-only and barrel files have no executable code (interfaces, type
      // aliases, const tuples re-exported via index). Excluding them keeps the
      // coverage signal focused on engine logic.
      exclude: ['src/types/**', 'src/index.ts'],
      thresholds: {
        lines: 85,
        branches: 85,
        functions: 85,
        statements: 85,
      },
    },
  },
});
