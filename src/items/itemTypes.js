// Item type registry. Each type declares its inventory footprint in grid
// cells (Diablo/Stoneshard-style — items aren't all 1x1) and, for stackable
// types, a maxStack. Non-stackable items always carry quantity 1.
// `validSlots` (character-sheet slot ids, see characterPanel.js's EQUIP_SLOTS)
// marks a type as equippable — its absence means the type can't be equipped
// at all (potions, gold).
// `use` (see src/items/useEffects.js for the effect shape) marks a type as
// usable — from the action bar, or via a right-click "Use" context-menu
// option (see surfaces.js). Only stackable consumables have it today; no
// equippable type does yet.
export const ITEM_TYPES = {
    helm: { id: 'helm', name: 'Helm', width: 2, height: 2, color: '#7d8fa0', label: 'HM', validSlots: ['head'] },
    sword: {
        id: 'sword',
        name: 'Sword',
        width: 1,
        height: 3,
        color: '#b0b0b8',
        label: 'SW',
        validSlots: ['rightHand', 'leftHand'],
    },
    belt: { id: 'belt', name: 'Belt', width: 2, height: 1, color: '#8a6d3b', label: 'BL', validSlots: ['belt'] },
    chestArmor: {
        id: 'chestArmor',
        name: 'Chest Armor',
        width: 2,
        height: 3,
        color: '#7d8fa0',
        label: 'CH',
        validSlots: ['chest'],
    },
    // The other 5 armor-slot item types — see src/data/armorSlots.js for how
    // each maps to a slot, its allowed weight tiers, and its generic naming
    // suffix ("Splint Greaves", etc.). Footprint sized roughly by real-world
    // scale (legs/chest biggest, hands/arms/boots/belt smallest).
    shoulderArmor: { id: 'shoulderArmor', name: 'Shoulder Armor', width: 2, height: 2, color: '#7d8fa0', label: 'SH', validSlots: ['shoulders'] },
    gloveArmor: { id: 'gloveArmor', name: 'Gloves', width: 1, height: 2, color: '#7d8fa0', label: 'GL', validSlots: ['hands'] },
    armArmor: { id: 'armArmor', name: 'Arm Armor', width: 1, height: 2, color: '#7d8fa0', label: 'AR', validSlots: ['arms'] },
    legArmor: { id: 'legArmor', name: 'Leg Armor', width: 2, height: 3, color: '#7d8fa0', label: 'LG', validSlots: ['pants'] },
    bootArmor: { id: 'bootArmor', name: 'Boots', width: 1, height: 2, color: '#7d8fa0', label: 'BO', validSlots: ['boots'] },
    healthPotion: {
        id: 'healthPotion',
        name: 'Health Potion',
        width: 1,
        height: 1,
        color: '#c0392b',
        label: 'HP',
        stackable: true,
        maxStack: 10,
        use: { type: 'resourceDelta', resource: 'health', amount: 20 },
        description: 'Restore 20 HP.',
    },
    energyPotion: {
        id: 'energyPotion',
        name: 'Energy Potion',
        width: 1,
        height: 1,
        color: '#2980b9',
        label: 'EP',
        stackable: true,
        maxStack: 10,
        use: { type: 'resourceDelta', resource: 'energy', amount: 10 },
        description: 'Restore 10 EP.',
    },
    damagePotion: {
        id: 'damagePotion',
        name: 'Damage Potion',
        width: 1,
        height: 1,
        color: '#6b2fa0',
        label: 'DP',
        stackable: true,
        maxStack: 10,
        use: { type: 'resourceDelta', resource: 'health', amount: -10 },
        description: 'Remove 10 HP.',
    },
    weakenPotion: {
        id: 'weakenPotion',
        name: 'Weaken Potion',
        width: 1,
        height: 1,
        color: '#3a3a6b',
        label: 'WP',
        stackable: true,
        maxStack: 10,
        use: { type: 'resourceDelta', resource: 'energy', amount: -5 },
        description: 'Remove 5 EP.',
    },
    gold: {
        id: 'gold',
        name: 'Gold',
        width: 1,
        height: 1,
        color: '#c9a227',
        label: 'G',
        stackable: true,
        maxStack: 1000,
    },
};
