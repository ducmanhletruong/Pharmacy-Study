const audienceRank = { public: 1, class: 2, owner_only: 3 } as const
export type Audience = keyof typeof audienceRank
export type ViewerTier = Audience | null

export function effectiveAudience(
  sources: readonly Audience[],
): Audience | null {
  return sources.reduce<Audience | null>(
    (restricted, audience) =>
      restricted === null || audienceRank[audience] > audienceRank[restricted]
        ? audience
        : restricted,
    null,
  )
}

export function canView(tier: ViewerTier, audience: Audience | null): boolean {
  return (
    tier === 'owner_only' ||
    (tier !== null &&
      audience !== null &&
      audienceRank[tier] >= audienceRank[audience])
  )
}
