const UNIT_MS: Record<string, number> = {
  ms: 1,
  s: 1000,
  m: 60_000,
  h: 3_600_000,
  d: 86_400_000,
};

/** Parses simple durations like "7d", "5m", "30s" (the format used by JWT_EXPIRES_IN etc). */
export function parseDurationMs(input: string): number {
  const match = /^(\d+)\s*(ms|s|m|h|d)$/.exec(input.trim());
  if (!match) {
    throw new Error(`Duração inválida: "${input}" (formato esperado: "7d", "5m", "30s"...)`);
  }
  return Number(match[1]) * UNIT_MS[match[2]];
}
