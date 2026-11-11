// Which tests/*.test.ts files run. Tests that need the GreenMail mail server are skipped in the unit run.
export const MAIL_SERVER_TESTS = ['integration.test.ts', 'server.test.ts']

export function selectTests(files, { unit, filter }) {
  return files
    .filter((f) => f.endsWith('.test.ts'))
    .filter((f) => !(unit && MAIL_SERVER_TESTS.includes(f)))
    .filter((f) => !filter || f.includes(filter))
}
