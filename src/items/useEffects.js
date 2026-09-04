// The one place "what does using this thing actually do" lives — shared by
// item potions and talents alike (see actionBar.js), both of which carry a
// `use` field in this same shape. `type` is a dispatch key rather than a
// flat {resource, amount} so a future effect kind (buffs, etc.) doesn't need
// a breaking change to this shape — not built out further than that, since
// only resourceDelta is needed today.
export const USE_EFFECTS = {
    resourceDelta(effect, player) {
        const resource = player.resources[effect.resource];
        if (!resource) return;
        resource.current = Math.max(0, Math.min(resource.max, resource.current + effect.amount));
    },
};

export function applyUse(use, player) {
    if (!use) return;
    USE_EFFECTS[use.type]?.(use, player);
}
