/**
 * Two-project split, per docs/testing-strategy.md's Tier 1 / Tier 2 design:
 *
 * - "pure": Domain, Application, Data, and infrastructure/http — zero React
 *   Native dependency, run under ts-jest + node.
 * - "react-native": Presentation (screens/hooks), the native-module
 *   boundary (ConnectivityService), and app-wiring under src/app (e.g.
 *   connectivityStore's AppState foreground-reconciliation fallback,
 *   BUG-015) — run under the RN jest preset, now that the RN CLI scaffold
 *   exists.
 *
 * clearMocks (not resetMocks) is deliberate: ConnectivityService.test.ts's
 * reference-counting assertions rely on per-test-cleared call counts while
 * still reusing mockResolvedValue/mockRejectedValue implementations set up
 * by earlier tests in the same file (resetMocks would null those out and
 * break tests that don't redeclare them).
 */
module.exports = {
  projects: [
    {
      displayName: 'pure',
      preset: 'ts-jest',
      testEnvironment: 'node',
      rootDir: '.',
      testMatch: [
        '<rootDir>/src/features/repositories/domain/**/*.test.ts',
        '<rootDir>/src/features/repositories/application/**/*.test.ts',
        '<rootDir>/src/features/repositories/data/**/*.test.ts',
        '<rootDir>/src/infrastructure/http/**/*.test.ts',
      ],
      clearMocks: true,
      restoreMocks: true,
    },
    {
      displayName: 'react-native',
      preset: 'react-native',
      rootDir: '.',
      testMatch: [
        '<rootDir>/src/features/repositories/presentation/**/*.test.{ts,tsx}',
        '<rootDir>/src/infrastructure/services/**/*.test.{ts,tsx}',
        '<rootDir>/src/app/**/*.test.{ts,tsx}',
      ],
      setupFiles: ['<rootDir>/jest.setup.native-modules.js'],
      setupFilesAfterEnv: ['<rootDir>/jest.setup.rn.js'],
      clearMocks: true,
      restoreMocks: true,
      transformIgnorePatterns: [
        'node_modules/(?!(?:.pnpm/)?((jest-)?react-native|@react-native(-community)?|@react-navigation|react-native-.*|@tanstack)/)',
      ],
    },
  ],
};
