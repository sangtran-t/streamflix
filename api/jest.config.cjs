/** @type {import('ts-jest').JestConfigWithTsJest} */
module.exports = {
  preset: 'ts-jest',
  testEnvironment: 'node',
  rootDir: 'src',
  testRegex: '.*\.spec\.ts$',
  moduleFileExtensions: ['ts', 'js', 'json'],
  // Use the test-specific tsconfig so @types/jest globals are recognised and
  // spec files are not excluded (they are in tsconfig.json exclude list).
  transform: {
    '^.+\.ts$': ['ts-jest', { tsconfig: '<rootDir>/../tsconfig.spec.json' }],
  },
  collectCoverageFrom: ['**/*.ts', '!**/*.spec.ts', '!**/*.module.ts', '!main.ts'],
  coverageDirectory: '../coverage',
};
