// Moves an item from one Inventory to another, respecting stacking and
// partial fits — if `to` only has room for some of a stack, the rest stays
// in `from` rather than being lost.
export function transferItem(from, to, itemId) {
    const item = from.items.find((it) => it.id === itemId);
    if (!item) return;

    const added = to.addItem(item.itemType, item.quantity, item.armor ?? null);
    if (added <= 0) return;

    if (added >= item.quantity) {
        from.removeItem(itemId);
    } else {
        item.quantity -= added;
    }
}

export function transferAll(from, to) {
    for (const item of [...from.items]) {
        transferItem(from, to, item.id);
    }
}

// Like transferItem, but tries to land at an exact (col,row) first — matching
// wherever the user actually dropped it during a drag, rather than always
// landing wherever addItem's first-fit scan finds room. Falls back to
// addItem's auto-placement if the exact spot doesn't work out (out of
// bounds, or occupied by something it can't stack with), so a drop that
// isn't pixel-perfect over an empty cell still succeeds somewhere instead of
// being silently rejected.
export function transferItemTo(from, to, itemId, col, row) {
    const item = from.items.find((it) => it.id === itemId);
    if (!item) return false;

    let remaining = to.placeAt(item.itemType, item.quantity, col, row, item.armor ?? null);
    if (remaining === item.quantity) {
        remaining = item.quantity - to.addItem(item.itemType, item.quantity, item.armor ?? null);
    }

    const added = item.quantity - remaining;
    if (added <= 0) return false;
    if (added >= item.quantity) {
        from.removeItem(itemId);
    } else {
        item.quantity -= added;
    }
    return true;
}
