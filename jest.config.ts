import type { Config } from 'jest';

const config: Config = {
  moduleFileExtensions: ['js', 'json', 'ts'],
  rootDir: '.',
  testMatch: [
    '<rootDir>/test/unit/**/*.spec.ts',
    '<rootDir>/test/integration/**/*.spec.ts',
  ],
  transform: {
    '^.+\\.(t|j)s$': [
      '@swc/jest',
      {
        jsc: {
          parser: { syntax: 'typescript', decorators: true },
          transform: { legacyDecorator: true, decoratorMetadata: true },
          target: 'es2022',
        },
        module: { type: 'commonjs' },
      },
    ],
  },
  collectCoverageFrom: [
    'src/**/*.ts',
    '!src/**/*.module.ts',
    '!src/main.ts',
  ],
  coverageDirectory: './coverage',
  testEnvironment: 'node',
  coverageThreshold: {
    global: {
      statements: 85,
      branches: 85,
    },
    './src/domain/authorization/**/*.ts': { statements: 90 },
    './src/domain/normalization/**/*.ts': { statements: 90 },
    './src/domain/redaction/**/*.ts': { statements: 90 },
    './src/domain/query/**/*.ts': { statements: 90 },
    './src/domain/limits/**/*.ts': { statements: 90 },
  },
};

export default config;
