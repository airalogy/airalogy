export function orderPackagesForPublishing(packages) {
  const byName = new Map(packages.map(pkg => [pkg.name, pkg]))
  const visiting = new Set()
  const visited = new Set()
  const ordered = []
  function visit(pkg) {
    if (visited.has(pkg.name)) return
    if (visiting.has(pkg.name)) throw new Error(`Circular release dependency: ${pkg.name}`)
    visiting.add(pkg.name)
    const dependencies = {
      ...pkg.dependencies,
      ...pkg.optionalDependencies,
      ...pkg.peerDependencies,
    }
    for (const name of Object.keys(dependencies).sort()) {
      if (byName.has(name)) visit(byName.get(name))
    }
    visiting.delete(pkg.name)
    visited.add(pkg.name)
    ordered.push(pkg)
  }
  for (const pkg of [...packages].sort((a, b) => a.name.localeCompare(b.name))) visit(pkg)
  return ordered
}

export async function npmVersionExists(name, version, request = fetch) {
  const response = await request(
    `https://registry.npmjs.org/${encodeURIComponent(name)}/${encodeURIComponent(version)}`,
    { headers: { accept: 'application/json' }, signal: AbortSignal.timeout(30_000) },
  )
  if (response.status === 404) return false
  if (response.status !== 200) throw new Error(`Unexpected npm response for ${name}@${version}: ${response.status}`)
  const published = await response.json()
  if (published.name !== name || published.version !== version) {
    throw new Error(`Unexpected npm identity for ${name}@${version}`)
  }
  return true
}
