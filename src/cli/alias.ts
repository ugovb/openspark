// The CLI used to be called `octo`. The old name still works and prints one line on stderr.

/** The notice for an old-name invocation, or null when the command was started as `openmail`. */
export function deprecatedAlias(invokedAs: string | undefined): string | null {
  return invokedAs === 'octo' ? 'note: the `octo` command is now called `openmail`. `octo` still works for now.' : null
}
