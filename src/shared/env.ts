// Configuration from the environment: OPENMAIL_<NAME> first, the legacy OCTO_<NAME> as a fallback.
// Empty values count as unset.

// The renderer bundle has no `process`: everything is unset there.
export function env(name: string): string | undefined {
  if (typeof process === 'undefined') return undefined
  return process.env[`OPENMAIL_${name}`] || process.env[`OCTO_${name}`] || undefined
}

export function envFlag(name: string): boolean {
  return ['1', 'true', 'yes'].includes((env(name) || '').toLowerCase())
}
