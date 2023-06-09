import { validatePackageURL } from '../../src/core/validate-graph';

describe('validatePackageURL', () => {
  describe('deb package type tests', () => {
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
});
