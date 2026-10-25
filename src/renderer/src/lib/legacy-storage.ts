// Browser-side settings were stored under `octo.*`. Copy them to `openmail.*` once; the old keys stay.
export function migrateStorage(): void {
  try {
    for (const key of Object.keys(localStorage)) {
      if (!key.startsWith('octo.')) continue
      const next = `openmail.${key.slice('octo.'.length)}`
      if (localStorage.getItem(next) === null) localStorage.setItem(next, localStorage.getItem(key) ?? '')
    }
  } catch {
    /* storage blocked: defaults apply */
  }
}
