import * as graphlib from '../graphlib';
import { PackageURL } from 'packageurl-js';
import * as types from './types';
import { ValidationError } from './errors';

const reGolangPseudoVersion = /(v\d+\.\d+\.\d+)-(.*?)(\d{14})-([0-9a-f]{12})/;
const reGolangExactVersion = /^(.*?)(\+incompatible)?$/;

function assert(condition: boolean, msg: string) {
  if (!condition) {
    throw new ValidationError(msg);
  }
}

export function validateGraph(
  graph: graphlib.Graph,
  rootNodeId: string,
  pkgs: { [pkgId: string]: any },
  pkgNodes: { [nodeId: string]: Set<string> },
): void {
  assert(
    (graph.predecessors(rootNodeId) || []).length === 0,
    `"${rootNodeId}" is not really the root`,
  );
  const reachableFromRoot = graphlib.alg.postorder(graph, [rootNodeId]);
  const nodeIds = graph.nodes();

  assert(
    JSON.stringify(nodeIds.sort()) === JSON.stringify(reachableFromRoot.sort()),
    'not all graph nodes are reachable from root',
  );

  const pkgIds = Object.keys(pkgs);
  const pkgsWithoutInstances = pkgIds.filter(
    (pkgId) => !pkgNodes[pkgId] || pkgNodes[pkgId].size === 0,
  );
  assert(pkgsWithoutInstances.length === 0, 'not all pkgs have instance nodes');

  for (const pkgId in pkgs) {
    try {
      validatePackageURL(pkgs[pkgId] as types.PkgInfo);
    } catch (e) {
      throw new ValidationError(`invalid pkg ${pkgId}: ${e}`);
    }
  }
}

export function validatePackageURL(pkg: types.PkgInfo): void {
  if (!pkg.purl) {
    return;
  }

  try {
    const purl = PackageURL.fromString(pkg.purl);

    // validate package name
    switch (purl.type) {
      // Within Snyk, maven packages use <namespace>:<name> as their *name*, but
      // we expect those to be separated correctly in the PackageURL.
      case 'maven':
        assert(
          pkg.name === purl.namespace + ':' + purl.name,
          `name and packageURL name do not match`,
        );
        break;

      // CocoaPods have an optional subspec encoded in the subpath
      // component of the purl, which – if present – should
      // be appended to the spec.
      case 'cocoapods':
        assert(
          pkg.name ===
            (purl.subpath ? `${purl.name}/${purl.subpath}` : purl.name),
          `name and packageURL name do not match`,
        );
        break;

      case 'golang': {
        let expected = purl.namespace
          ? `${purl.namespace}/${purl.name}`
          : purl.name;
        if (purl.subpath) expected += `/${purl.subpath}`;
        assert(pkg.name === expected, `name and packageURL name do not match`);
        break;
      }

      case 'composer':
      case 'npm':
      case 'swift':
        assert(
          pkg.name ===
            (purl.namespace ? `${purl.namespace}/${purl.name}` : purl.name),
          `name and packageURL name do not match`,
        );
        break;

      // The PURL spec for Linux distros does not include the source in the name.
      // This is why we relax the assertion here and match only on the package name:
      // <source name>/<package name> - we omit the source name
      // For now, make this exception only for deb to cover a support case.
      case 'deb': {
        const pkgName = pkg.name.split('/').pop();
        assert(pkgName === purl.name, 'name and packageURL name do not match');
        if (purl.qualifiers?.['upstream'] && pkg.name.includes('/')) {
          const pkgSrc = pkg.name.split('/')[0];
          const pkgUpstream = purl.qualifiers['upstream'].split('@')[0];
          assert(
            pkgSrc === pkgUpstream,
            'source and packageURL source do not match',
          );
        }
        break;
      }

      default:
        assert(pkg.name === purl.name, `name and packageURL name do not match`);
    }

    // validate package version
    switch (purl.type) {
      // the Snyk version of a golang module is either
      // - the version without "v", e.g. v1.2.3 -> 1.2.3
      // - the pseudo-version hash, e.g. v0.0.0-000-acf48ae230a1 -> #acf48ae230a1
      case 'golang': {
        let version = purl.version;
        if (purl.version) {
          const maybePseudoVersion = reGolangPseudoVersion.exec(purl.version);
          const maybeExactVersion = reGolangExactVersion.exec(purl.version);
          if (maybePseudoVersion) {
            version = `#${maybePseudoVersion[4]}`;
          } else if (maybeExactVersion) {
            version = maybeExactVersion[1].replace(/^v/, '');
          }
        }
        assert(
          pkg.version === version,
          `version and packageURL version do not match. want ${pkg.version} have: ${version}`,
        );
        break;
      }

      default:
        assert(
          pkg.version === purl.version,
          `version and packageURL version do not match`,
        );
    }
  } catch (e) {
    throw new ValidationError(`packageURL validation failed: ${e}`);
  }
}
