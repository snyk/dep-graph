import { validatePackageURL } from '../../src/core/validate-graph';

describe('validatePackageURL', () => {
  describe('deb Purl type tests', () => {
    it.each([
      [
        'package name includes source',
        {
          name: 'foo/bar',
          version: '1.2.3',
          purl: 'pkg:deb/bar@1.2.3',
        },
      ],
      [
        'purl is namespaced (includes a vendor)',
        {
          name: 'foo/bar',
          version: '1.2.3',
          purl: 'pkg:deb/debian/bar@1.2.3',
        },
      ],
      [
        'package name does not include source',
        {
          name: 'bar',
          version: '1.2.3',
          purl: 'pkg:deb/bar@1.2.3',
        },
      ],
      [
        'matches on upstream where only the source name is provided',
        {
          name: 'foo/bar',
          version: '1.2.3',
          purl: 'pkg:deb/bar@1.2.3?upstream=foo',
        },
      ],
      [
        'matches on upstream where full upstream is provided',
        {
          name: 'foo/bar',
          version: '1.2.3',
          purl: 'pkg:deb/bar@1.2.3?upstream=foo%401.2.3',
        },
      ],
      [
        'matches on package name where source is unavailable',
        {
          name: 'bar',
          version: '1.2.3',
          purl: 'pkg:deb/bar@1.2.3?upstream=foo%401.2.3',
        },
      ],
    ])(
      'matches only on package name for debian purls: %s',
      (_testCaseName, pkg) => {
        expect(() => validatePackageURL(pkg)).not.toThrow();
      },
    );

    it.each([
      [
        'package name does not match purl name',
        {
          name: 'foo/bar',
          version: '1.2.3',
          purl: 'pkg:deb/baz@1.2.3',
        },
      ],
      [
        'package source does not match purl source',
        {
          name: 'foo/bar',
          version: '1.2.3',
          purl: 'pkg:deb/bar@1.2.3?upstream=baz',
        },
      ],
      [
        'purl includes source name',
        {
          name: 'foo/bar',
          version: '1.2.3',
          purl: 'pkg:deb/debian/foo%2Fbar@1.2.3',
        },
      ],
    ])('should throw on invalid purl: %s', (_testCaseName, pkg) => {
      expect(() => validatePackageURL(pkg)).toThrow();
    });
  });

  describe('cocoapods Purl type tests', () => {
    it.each([
      [
        'cocoapods package without subspec',
        {
          name: 'bar',
          version: '1.2.3',
          purl: 'pkg:cocoapods/bar@1.2.3',
        },
      ],
      [
        'cocoapods package with subspec',
        {
          name: 'spec/subspec',
          version: '1.2.3',
          purl: 'pkg:cocoapods/spec@1.2.3#subspec',
        },
      ],
    ])('validates cocoapods Purls: %s', (name, pkg) => {
      expect(() => validatePackageURL(pkg)).not.toThrow();
    });

    it.each([
      [
        'package name does not match purl name',
        {
          name: 'foo',
          version: '1.2.3',
          purl: 'pkg:cocoapods/baz@1.2.3',
        },
      ],
      [
        'package name does not match subspec',
        {
          name: 'baz/foo',
          version: '1.2.3',
          purl: 'pkg:cocoapods/baz@1.2.3#bar',
        },
      ],
      [
        'package name does not include subspec',
        {
          name: 'bar',
          version: '1.2.3',
          purl: 'pkg:cocoapods/bar@1.2.3#baz',
        },
      ],
    ])('should throw on invalid purl: %s', (name, pkg) => {
      expect(() => validatePackageURL(pkg)).toThrow();
    });
  });

  describe('composer Purl type tests', () => {
    it.each([
      [
        'composer package without namespace',
        {
          name: 'bar',
          version: '1.2.3',
          purl: 'pkg:composer/bar@1.2.3',
        },
      ],
      [
        'composer package with namespace',
        {
          name: 'vendor/bar',
          version: '1.2.3',
          purl: 'pkg:composer/vendor/bar@1.2.3',
        },
      ],
    ])('validates composer Purls: %s', (name, pkg) => {
      expect(() => validatePackageURL(pkg)).not.toThrow();
    });

    it.each([
      [
        'package name does not match purl name',
        {
          name: 'foo/bar',
          version: '1.2.3',
          purl: 'pkg:composer/baz@1.2.3',
        },
      ],
      [
        'package name does not match purl namespace',
        {
          name: 'foo/bar',
          version: '1.2.3',
          purl: 'pkg:composer/baz/bar@1.2.3',
        },
      ],
      [
        'package name does not include purl namespace',
        {
          name: 'bar',
          version: '1.2.3',
          purl: 'pkg:composer/baz/bar@1.2.3',
        },
      ],
    ])('should throw on invalid purl: %s', (name, pkg) => {
      expect(() => validatePackageURL(pkg)).toThrow();
    });
  });

  describe('golang Purl type tests', () => {
    it.each([
      [
        'golang package with namespace',
        {
          name: 'github.com/foo/bar',
          version: '1.2.3',
          purl: 'pkg:golang/github.com/foo/bar@1.2.3',
        },
      ],
      [
        'golang package without namespace',
        {
          name: 'foo',
          version: '1.2.3',
          purl: 'pkg:golang/foo@1.2.3',
        },
      ],
      [
        'golang package with subpath',
        {
          name: 'github.com/foo/bar/pkg/baz',
          version: '1.2.3',
          purl: 'pkg:golang/github.com/foo/bar@1.2.3#pkg/baz',
        },
      ],
      [
        'golang package with exact version',
        {
          name: 'github.com/foo/bar',
          version: '1.2.3',
          purl: 'pkg:golang/github.com/foo/bar@v1.2.3',
        },
      ],
      [
        'golang package with incompatible version',
        {
          name: 'github.com/foo/bar',
          version: '1.2.3',
          purl: 'pkg:golang/github.com/foo/bar@v1.2.3%2Bincompatible',
        },
      ],
      [
        'golang package with pseudo version',
        {
          name: 'github.com/foo/bar',
          version: '#0123456abcde',
          purl: 'pkg:golang/github.com/foo/bar@v0.0.0-19700101000000-0123456abcde',
        },
      ],
    ])('validates golang Purls: %s', (name, pkg) => {
      expect(() => validatePackageURL(pkg)).not.toThrow();
    });

    it.each([
      [
        'package name does not match purl name',
        {
          name: 'foo/bar',
          version: '1.2.3',
          purl: 'pkg:golang/baz@1.2.3',
        },
      ],
      [
        'package name does not match purl namespace',
        {
          name: 'foo/bar',
          version: '1.2.3',
          purl: 'pkg:golang/google.golang.org/bar@1.2.3',
        },
      ],
      [
        'package name does not match purl subpath',
        {
          name: 'bar/baz',
          version: '1.2.3',
          purl: 'pkg:golang/bar@1.2.3#pkg/baz',
        },
      ],
      [
        'package name does not include purl namespace',
        {
          name: 'bar',
          version: '1.2.3',
          purl: 'pkg:golang/google.golang.org/bar@1.2.3',
        },
      ],
      [
        'package name does not include purl subpath',
        {
          name: 'bar',
          version: '1.2.3',
          purl: 'pkg:golang/bar@1.2.3#pkg/baz',
        },
      ],
      [
        'golang package with incorrectly encoded version',
        {
          name: 'github.com/foo/bar',
          version: '1.2.3',
          purl: 'pkg:golang/github.com/foo/bar@v1.2.3+incompatible',
        },
      ],
    ])('should throw on invalid purl: %s', (name, pkg) => {
      expect(() => validatePackageURL(pkg)).toThrow();
    });
  });

  describe('npm Purl type tests', () => {
    it.each([
      [
        'npm package without namespace',
        {
          name: 'bar',
          version: '1.2.3',
          purl: 'pkg:npm/bar@1.2.3',
        },
      ],
      [
        'npm package with namespace',
        {
          name: '@foo/bar',
          version: '1.2.3',
          purl: 'pkg:npm/%40foo/bar@1.2.3',
        },
      ],
    ])('validates npm Purls: %s', (name, pkg) => {
      expect(() => validatePackageURL(pkg)).not.toThrow();
    });

    it.each([
      [
        'package name does not match purl name',
        {
          name: 'foo/bar',
          version: '1.2.3',
          purl: 'pkg:npm/baz@1.2.3',
        },
      ],
      [
        'package name does not match purl namespace',
        {
          name: 'foo/bar',
          version: '1.2.3',
          purl: 'pkg:npm/%40baz/bar@1.2.3',
        },
      ],
      [
        'package name does not include purl namespace',
        {
          name: 'bar',
          version: '1.2.3',
          purl: 'pkg:npm/%40baz/bar@1.2.3',
        },
      ],
    ])('should throw on invalid purl: %s', (name, pkg) => {
      expect(() => validatePackageURL(pkg)).toThrow();
    });
  });

  describe('swift Purl type tests', () => {
    it.each([
      [
        'swift package with namespace',
        {
          name: 'github.com/foo/bar',
          version: '1.2.3',
          purl: 'pkg:swift/github.com/foo/bar@1.2.3',
        },
      ],
    ])('validates swift Purls: %s', (name, pkg) => {
      expect(() => validatePackageURL(pkg)).not.toThrow();
    });

    it.each([
      [
        'package name does not match purl name',
        {
          name: 'foo/bar',
          version: '1.2.3',
          purl: 'pkg:swift/baz@1.2.3',
        },
      ],
      [
        'package name does not match purl namespace',
        {
          name: 'foo/bar',
          version: '1.2.3',
          purl: 'pkg:swift/baz/bar@1.2.3',
        },
      ],
      [
        'package name does not include purl namespace',
        {
          name: 'bar',
          version: '1.2.3',
          purl: 'pkg:swift/baz/bar@1.2.3',
        },
      ],
    ])('should throw on invalid purl: %s', (name, pkg) => {
      expect(() => validatePackageURL(pkg)).toThrow();
    });
  });
});
