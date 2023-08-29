import * as graphlib from '../graphlib';
import { PackageURL } from 'packageurl-js';
import * as types from './types';
import { ValidationError } from './errors';

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
) {
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
    const purlPkg = PackageURL.fromString(pkg.purl);

    switch (purlPkg.type) {
      // Within Snyk, maven packages use <namespace>:<name> as their *name*, but
      // we expect those to be separated correctly in the PackageURL.
      case 'maven':
        assert(
          pkg.name === purlPkg.namespace + ':' + purlPkg.name,
          `name and packageURL name do not match`,
        );
        break;

      case 'golang': {
        let expected = purlPkg.namespace
          ? `${purlPkg.namespace}/${purlPkg.name}`
          : purlPkg.name;
        if (purlPkg.subpath) expected += `/${purlPkg.subpath}`;
        assert(pkg.name === expected, `name and packageURL name do not match`);
        break;
      }

      case 'composer':
      case 'npm':
      case 'swift':
        assert(
          pkg.name ===
            (purlPkg.namespace
              ? `${purlPkg.namespace}/${purlPkg.name}`
              : purlPkg.name),
          `name and packageURL name do not match`,
        );
        break;

      // The PURL spec for Linux distros does not include the source in the name.
      // This is why we relax the assertion here and match only on the package name:
      // <source name>/<package name> - we omit the source name
      // For now, make this exception only for deb to cover a support case.
      case 'deb': {
        const pkgName = pkg.name.split('/').pop();
        assert(
          pkgName === purlPkg.name,
          'name and packageURL name do not match',
        );
        if (purlPkg.qualifiers?.['upstream'] && pkg.name.includes('/')) {
          const pkgSrc = pkg.name.split('/')[0];
          const pkgUpstream = purlPkg.qualifiers['upstream'].split('@')[0];
          assert(
            pkgSrc === pkgUpstream,
            'source and packageURL source do not match',
          );
        }
        break;
      }

      default:
        assert(
          pkg.name === purlPkg.name,
          `name and packageURL name do not match`,
        );
    }
    assert(
      pkg.version === purlPkg.version,
      `version and packageURL version do not match`,
    );
  } catch (e) {
    throw new ValidationError(`packageURL validation failed: ${e}`);
  }
}
