// Bundles the `openmail` CLI / MCP server into out/cli/openmail.js (dependencies stay in node_modules).
// out/cli/octo.js is the deprecated alias: it marks itself and loads the same bundle.
import { build } from 'esbuild'
import fs from 'node:fs'
import path from 'node:path'

const root = path.resolve(import.meta.dirname, '..')
await build({
  entryPoints: [path.join(root, 'src/cli/openmail.ts')],
  outfile: path.join(root, 'out/cli/openmail.js'),
  bundle: true,
  platform: 'node',
  format: 'cjs',
  target: 'node22',
  packages: 'external',
  banner: { js: '#!/usr/bin/env node' },
  logLevel: 'warning',
})
fs.writeFileSync(
  path.join(root, 'out/cli/octo.js'),
  "#!/usr/bin/env node\n// Deprecated name of the CLI. Kept until the old names are removed.\nprocess.env.OPENMAIL_INVOKED_AS = 'octo'\nrequire('./openmail.js')\n",
  { mode: 0o755 },
)
console.log('CLI → out/cli/openmail.js (+ octo.js alias)')
