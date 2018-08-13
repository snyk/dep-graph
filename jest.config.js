module.exports = {
  preset: 'ts-jest',
  testEnvironment: 'node',
  collectCoverage: false, // Enabled by running `npm run test:coverage`
  collectCoverageFrom: [ 'src/**/*.ts' ],
  coverageReporters: ['text-summary', 'html'],
  testPathIgnorePatterns: ['/src/', '/node_modules/'],
};
