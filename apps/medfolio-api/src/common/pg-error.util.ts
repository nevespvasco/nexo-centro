/** Drizzle wraps the driver error as `cause` behind a generic "Failed query" message. */
export function pgErrorCode(err: unknown): string | undefined {
  const cause = err instanceof Error ? err.cause : undefined;
  return cause && typeof cause === 'object' && 'code' in cause
    ? (cause as { code?: string }).code
    : undefined;
}

export function pgConstraintName(err: unknown): string | undefined {
  const cause = err instanceof Error ? err.cause : undefined;
  return cause && typeof cause === 'object' && 'constraint' in cause
    ? (cause as { constraint?: string }).constraint
    : undefined;
}
