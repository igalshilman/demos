import { defineConfig } from 'vitest/config';

// The other suites under tests/ use node:test (run with `node --test`), so
// only the vitest-style files are listed here.
export default defineConfig({
  test: {
    environment: 'node',
    include: [
      'src/**/*.test.js',
      'tests/collision.test.js',
      'tests/movement.test.js',
      'tests/hud.test.js',
    ],
    setupFiles: ['./tests/setup.js'],
  },
});
