// A project group is a named collection of tags. A card belongs to it when
// its own tags match the group's set — "any" (at least one) or "all" (every
// one). Membership is derived here, never stored on the card.

export type ProjectGroupMatchMode = 'any' | 'all';

export type ProjectGroupRule = {
  tags?: string[] | null;
  matchMode?: ProjectGroupMatchMode | string | null;
};

export function isInProjectGroup(cardTags: string[] | null | undefined, group: ProjectGroupRule): boolean {
  const wanted = group.tags ?? [];
  if (wanted.length === 0) return false;
  const have = cardTags ?? [];
  return group.matchMode === 'all'
    ? wanted.every((t) => have.includes(t))
    : wanted.some((t) => have.includes(t));
}

export function isInAnyProjectGroup(cardTags: string[] | null | undefined, groups: ProjectGroupRule[]): boolean {
  return groups.some((g) => isInProjectGroup(cardTags, g));
}
