import { CLASSES } from '../data/classes.js';
import { SUBCLASSES } from '../data/subclasses.js';
import { dropAt } from '../world/drop.js';
import { DEFAULT_ATTRIBUTES } from './attributeDefaults.js';
import { ZERO_BONUSES, computeEquipmentBonuses } from '../items/equipmentBonuses.js';

// Health is linear in both Strength and Level — the user's call: even a
// build that never invests in Strength (e.g. a pure-Intelligence mage)
// should still get *somewhat* tougher just from leveling, not stay
// permanently fragile. Strength stays the dominant lever on purpose —
// HEALTH_PER_LEVEL is deliberately smaller than HEALTH_PER_STRENGTH, a
// modest floor rather than matching it point-for-point. (Level-1) so a
// level-1 character adds nothing extra, preserving the already-tuned 50 at
// 5 STR / level 1.
const HEALTH_BASE = 25;
const HEALTH_PER_STRENGTH = 5;
const HEALTH_PER_LEVEL = 3;

export function healthMaxFor(strength, level) {
    return HEALTH_BASE + strength * HEALTH_PER_STRENGTH + (level - 1) * HEALTH_PER_LEVEL;
}

// Recomputes resources.health.max from the player's current Strength and
// Level, and keeps `current` in sync — a player at full health stays full
// (the pool just got bigger), otherwise current is clamped to the new max.
// Doesn't heal or damage the player itself. Call after anything that changes
// Strength or Level (spending a stat point, granting a level, construction,
// deserialize).
export function syncHealthFromAttributes(player) {
    const bonuses = computeEquipmentBonuses(player.equipment);
    const newMax = healthMaxFor(player.attributes.strength + bonuses.strength, player.level) + bonuses.health;
    const wasFull = player.resources.health.current >= player.resources.health.max;
    player.resources.health.max = newMax;
    player.resources.health.current = wasFull ? newMax : Math.min(player.resources.health.current, newMax);
}

// Energy deliberately uses a DIFFERENT shape than Health's straight line —
// diminishing marginal returns per Intelligence point, since not many skills
// are expected to lean on Energy heavily. Originally built as a geometric
// series (each point worth a fixed fraction of the last), but that
// necessarily converges to a hard ceiling — and the user flagged that as a
// real problem, not just a numbers tweak: their actual goal is that stacking
// a stat should ALWAYS keep paying off (so an all-in Intelligence build
// stays meaningfully rewarded), just at a shrinking rate — a hard cap kills
// that incentive once a character gets near it, no matter where the cap is
// set. Square-root scaling gets both properties at once: marginal return per
// point shrinks (1/(2*sqrt(x)) decreases), but the total never plateaus.
// Tuned so a fresh character (5 INT) still gets 20, per the earlier
// resource-scarcity discussion — Energy stays comparatively tight next to
// Health at equal investment (e.g. 100 INT -> ~72 vs 100 STR -> 525 Health),
// it just no longer hard-caps in the high-20s regardless of investment.
const ENERGY_BASE = 5;
const ENERGY_PER_SQRT_INTELLIGENCE = 6.71;

export function energyMaxFor(intelligence) {
    return Math.round(ENERGY_BASE + ENERGY_PER_SQRT_INTELLIGENCE * Math.sqrt(Math.max(0, intelligence)));
}

// Same idea as syncHealthFromAttributes, for Energy/Intelligence.
export function syncEnergyFromAttributes(player) {
    const bonuses = computeEquipmentBonuses(player.equipment);
    const newMax = energyMaxFor(player.attributes.intelligence + bonuses.intelligence) + bonuses.energy;
    const wasFull = player.resources.energy.current >= player.resources.energy.max;
    player.resources.energy.max = newMax;
    player.resources.energy.current = wasFull ? newMax : Math.min(player.resources.energy.current, newMax);
}

// Defense's meaning comes from the combat system the user described (not yet
// built): attacker rolls 2d6 + Attack + bonuses; Defense is subtracted from
// that roll, and only the remainder (if positive) becomes damage. So Defense
// is a flat threshold against a bounded dice roll, not a % dodge chance — no
// hard cap is mathematically required the way avoidance would need one. Same
// square-root shape as Energy, and for the same reason: a hard-ceiling
// geometric curve (the original version of this) meant Dexterity stopped
// paying off once a build got near the cap, which directly worked against
// the user's actual goal — investing entirely in one attribute should keep
// being rewarded, not taper into irrelevance, while neglecting it should
// keep hurting. Sqrt keeps giving smaller-but-real gains no matter how much
// Dexterity is already invested.
//
// Base (Dexterity-only, no gear) is still deliberately modest — per the
// user, Defense will eventually be the sum of ~8-9 gear pieces on top of
// this, so most of a character's real defense is meant to come from
// itemization later, not the base formula. Tuned so a fresh character
// (5 DEX) still gets 8. Attack itself is still a flat placeholder (see
// CLASSES.baseAttack), so exactly how much Defense "should" matter relative
// to it isn't really settled yet — this is a starting point, not a balanced
// number (see the 2026-09-04 base-Attack-feels-too-strong discussion in
// project_item_system_roadmap for where this is headed next).
const DEFENSE_BASE = 2;
const DEFENSE_PER_SQRT_DEXTERITY = 2.683;

export function defenseFor(dexterity) {
    return Math.round(DEFENSE_BASE + DEFENSE_PER_SQRT_DEXTERITY * Math.sqrt(Math.max(0, dexterity)));
}

// Carry Capacity is the one derived stat that isn't just a displayed number
// — it directly controls the size/shape of player.inventory (see
// Inventory.resizeCapacity). Base 20 matches today's fixed 4x5 grid exactly
// (nothing changes for a fresh character); same sqrt/diminishing shape as
// Defense and Energy, for the same "keep rewarding investment" reasoning.
const CAPACITY_BASE = 12;
const CAPACITY_PER_SQRT_STRENGTH = 3.578; // tuned so 5 STR -> 20, matching today's fixed 4x5 grid

export function capacityFor(strength) {
    return Math.round(CAPACITY_BASE + CAPACITY_PER_SQRT_STRENGTH * Math.sqrt(Math.max(0, strength)));
}

// Unlike the other sync functions, this needs `level` (the world): a
// capacity DECREASE can evict items that no longer fit anywhere in the
// resized grid (see Inventory.resizeCapacity's return value), and those need
// to land somewhere real — dropped at the player's feet via the same dropAt
// the right-click Drop action already uses, becoming a normal ground item or
// pile exactly like a manual drop would. Today's actual usage (Strength only
// ever grows) never evicts anything — this exists for when itemization
// introduces ways to lose capacity.
export function syncCarryCapacityFromAttributes(player, level) {
    const bonuses = computeEquipmentBonuses(player.equipment);
    const capacity = capacityFor(player.attributes.strength + bonuses.strength) + bonuses.carryCapacity;
    const evicted = player.inventory.resizeCapacity(capacity);
    for (const item of evicted) {
        dropAt(level, player.inventory, item, item.quantity, player.col, player.row);
    }
}

// Speed is actions-per-round in the (not yet built) Stoneshard-inspired
// combat system — per the user, this is deliberately "the slowest increasing
// stat... one of the most powerful things in the system," so it does NOT get
// the smooth sqrt treatment every other stat uses. Instead it's an integer
// step function: 1 action at base (5 DEX, confirmed), and each successive
// action requires an ever-GROWING chunk of Dexterity — not just diminishing
// value per point (like sqrt already gives everything else), but an actively
// widening gap between thresholds, so stacking Speed past the 2nd action is
// a deliberate, expensive choice rather than something a normal build
// gradually drifts into. Implemented as floor(sqrt(dex - 5) / SPEED_STEP):
// thresholds land at dex = 5 + (n * SPEED_STEP)^2, i.e. 30 / 105 / 230 / 405
// / ... for actions 2 / 3 / 4 / 5 — reachable-but-real for the 2nd (per the
// user: "the player should be able to get to a second action"), then each
// next one costs far more than the last (75, then 125, then 175 more
// Dexterity). Never hard-caps — matches the user's own framing that the
// game may scale indefinitely, with each further action simply becoming
// less and less worth it rather than mathematically impossible.
const SPEED_BASE_DEXTERITY = 5;
const SPEED_STEP = 5;

export function speedFor(dexterity) {
    const investment = Math.max(0, dexterity - SPEED_BASE_DEXTERITY);
    return 1 + Math.floor(Math.sqrt(investment) / SPEED_STEP);
}

// Acuity is the flat modifier added to a combatant's `2d6 + Acuity`
// initiative roll (see the Stoneshard-inspired turn-order system the user
// described — highest current initiative acts, spending some of it, until
// everyone re-rolls). Governed by Intelligence per the original stat list.
// Mechanically it's the initiative-roll analog of Defense (a flat bonus
// against a bounded 2d6-shaped roll), so it gets the same sqrt/diminishing
// shape and the same "modest base, no hard cap" reasoning — a huge flat
// bonus would trivialize turn order the same way a huge Defense would
// trivialize getting hit. Tuned so a fresh character (5 INT) gets 6.
const ACUITY_BASE = 2;
const ACUITY_PER_SQRT_INTELLIGENCE = 2;

export function acuityFor(intelligence) {
    return Math.round(ACUITY_BASE + ACUITY_PER_SQRT_INTELLIGENCE * Math.sqrt(Math.max(0, intelligence)));
}

// Attack = class's flat base + a sqrt-diminishing contribution from the
// class's primary attribute (CLASSES[x].primaryAttribute) + — once a
// subclass is chosen (permanent, unlocks at SUBCLASS_UNLOCK_LEVEL, see
// src/data/subclasses.js) — half that same contribution curve applied to
// the subclass's secondary attribute. Per the user: "the scaling is 0.5
// scaling of what the PRIMARY attribute would do" — i.e. the SAME formula,
// not a separate one, just half-weighted, so a primary/secondary pair on
// the same attribute (Barbarian, Assassin, Archmage) simply counts that
// attribute at 1.5x instead of introducing new math.
//
// ATTACK_PER_SQRT_ATTRIBUTE is calibrated to the user's own worked example,
// not an arbitrary anchor like the other stats: going from 5 to 10 in the
// primary attribute should read as a clean +2, and half that (secondary)
// a clean +1 — 2.159 hits both exactly after rounding (contribution(5)=5,
// contribution(10)=7). Primary and secondary contributions are computed
// from the same *unrounded* curve and rounded independently (not "round the
// primary, then halve"), so results stay consistent regardless of which
// attribute ends up primary vs secondary.
//
// Deliberately NOT yet re-examined against baseAttack (still flat 10 for
// every class) — adding this on top makes a fresh, unarmed level-1
// character's Attack go up, not down, which the user flagged as a possible
// concern already at baseAttack=10 alone. Wiring the primary/secondary
// mechanic was the ask; re-tuning baseAttack in light of it is explicitly a
// separate, later balance pass (see project_item_system_roadmap memory).
const ATTACK_PER_SQRT_ATTRIBUTE = 2.159;

function attackAttributeContributionRaw(attributeValue) {
    return ATTACK_PER_SQRT_ATTRIBUTE * Math.sqrt(Math.max(0, attributeValue));
}

export function attackFor(attributes, classId, subclassId) {
    const cls = CLASSES[classId];
    const base = cls?.baseAttack ?? 0;
    const primary = cls?.primaryAttribute ? Math.round(attackAttributeContributionRaw(attributes[cls.primaryAttribute])) : 0;
    const subclass = subclassId ? SUBCLASSES[subclassId] : null;
    const secondary = subclass ? Math.round(0.5 * attackAttributeContributionRaw(attributes[subclass.secondaryAttribute])) : 0;
    return base + primary + secondary;
}

// Derived stats, computed fresh from base attributes (+ class/subclass for Attack) —
// never stored on Player except Health and Energy, which also drive
// resources.health/energy (see syncHealthFromAttributes/syncEnergyFromAttributes).
// Tier 3 is still a flat 1:1 placeholder (derived = governing attribute) —
// the actual scaling per stat is being decided one at a time.
//
// Tier 1: Health(STR + level, linear, uncapped), Defense(DEX, sqrt — uncapped but diminishing), Energy(INT, sqrt — uncapped but diminishing), Attack(class base + primary attribute, + 0.5x secondary once subclassed)
// Tier 2: Carry Capacity(STR, sqrt — also drives player.inventory's actual size), Speed(DEX, integer step — uncapped but deliberately rare), Acuity(INT, sqrt — uncapped but diminishing)
// Tier 3 (magic resistances): Fire(STR), Lightning(DEX), Arcane(INT)
// Tier 3 (physical resistances): Blunt(STR), Slash(DEX), Pierce(INT) —
// added alongside the magic three, same flat 1:1 placeholder shape and
// governing-attribute reasoning (see STAT_GOVERNING_ATTRIBUTE in
// src/data/armorTypes.js for the by-attribute justification).
//
// `equipmentBonuses` (see src/items/equipmentBonuses.js) folds in two ways:
// an attribute bonus (strength/dexterity/intelligence, from a rolled
// attribute affix) boosts the EFFECTIVE attribute used by every formula
// below, so e.g. a +1 Strength affix raises Health/CarryCapacity/Fire too,
// not just a displayed Strength number; a direct bonus on a derived stat
// itself (e.g. a rolled 'defense' affix, or an armor piece's own base
// Defense value) is added flat on top of that stat's formula result.
export function computeDerivedStats(attributes, classId, level, subclassId, equipmentBonuses = ZERO_BONUSES) {
    const effectiveAttributes = {
        strength: attributes.strength + equipmentBonuses.strength,
        dexterity: attributes.dexterity + equipmentBonuses.dexterity,
        intelligence: attributes.intelligence + equipmentBonuses.intelligence,
    };
    const { strength, dexterity, intelligence } = effectiveAttributes;

    return {
        tier1: {
            health: healthMaxFor(strength, level) + equipmentBonuses.health,
            defense: defenseFor(dexterity) + equipmentBonuses.defense,
            energy: energyMaxFor(intelligence) + equipmentBonuses.energy,
            attack: attackFor(effectiveAttributes, classId, subclassId) + equipmentBonuses.attack,
        },
        tier2: {
            carryCapacity: capacityFor(strength) + equipmentBonuses.carryCapacity,
            speed: speedFor(dexterity) + equipmentBonuses.speed,
            acuity: acuityFor(intelligence) + equipmentBonuses.acuity,
        },
        tier3: {
            fire: strength + equipmentBonuses.fire,
            lightning: dexterity + equipmentBonuses.lightning,
            arcane: intelligence + equipmentBonuses.arcane,
            blunt: strength + equipmentBonuses.blunt,
            slash: dexterity + equipmentBonuses.slash,
            pierce: intelligence + equipmentBonuses.pierce,
        },
    };
}

// Where a stat's current value comes from — shown when hovering the number
// itself on the Character panel (as opposed to hovering its label, which
// shows STAT_INFO's plain description instead). Works for every stat, base
// attribute or derived: each row is a real component of that stat's actual
// formula (not a generic template), so `Base + <governing attribute rows> +
// Level + Equipment + Talents` always sums to exactly the displayed Total —
// verified by construction below, since every BASE_* constant here is an
// integer, so splitting `round(base + x)` into `base + round(x)` never
// introduces a rounding mismatch.
//
// Equipment is real (see src/items/equipmentBonuses.js) — Talents is still
// hardcoded to 0 (no talent grants stat bonuses yet). Both stay shown, at
// whatever they resolve to, so this breakdown's shape needed no UI rework
// when Equipment stopped being a placeholder.
const ATTRIBUTE_LABELS = { strength: 'Strength', dexterity: 'Dexterity', intelligence: 'Intelligence' };

function sqrtBreakdown(base, perSqrt, attributeKey, attributeValue, equipment, talents) {
    const fromAttribute = Math.round(perSqrt * Math.sqrt(Math.max(0, attributeValue)));
    return [
        { label: 'Base', value: base },
        { label: ATTRIBUTE_LABELS[attributeKey], value: fromAttribute },
        { label: 'Equipment', value: equipment },
        { label: 'Talents', value: talents },
        { label: 'Total', value: base + fromAttribute + equipment + talents },
    ];
}

export function statBreakdown(player, key) {
    // effectiveAttributes mirrors computeDerivedStats exactly — every read
    // of strength/dexterity/intelligence below uses these (equipment-
    // boosted) values, never raw player.attributes, so the displayed Total
    // always matches what the Character panel actually shows once a
    // Strength/Dexterity/Intelligence affix is equipped (a real bug caught
    // during planning: reading raw attributes in some places and boosted
    // values in others silently breaks the Base+rows=Total invariant).
    const equipmentBonuses = computeEquipmentBonuses(player.equipment);
    const effectiveAttributes = {
        strength: player.attributes.strength + equipmentBonuses.strength,
        dexterity: player.attributes.dexterity + equipmentBonuses.dexterity,
        intelligence: player.attributes.intelligence + equipmentBonuses.intelligence,
    };
    const equipment = equipmentBonuses[key] ?? 0;
    const talents = 0;

    if (key in DEFAULT_ATTRIBUTES) {
        const base = DEFAULT_ATTRIBUTES[key];
        const total = effectiveAttributes[key];
        const level = total - base - equipment - talents;
        return [
            { label: 'Base', value: base },
            { label: 'Level', value: level },
            { label: 'Equipment', value: equipment },
            { label: 'Talents', value: talents },
            { label: 'Total', value: total },
        ];
    }

    const { strength, dexterity, intelligence } = effectiveAttributes;

    switch (key) {
        case 'health': {
            const fromStrength = strength * HEALTH_PER_STRENGTH;
            const fromLevel = (player.level - 1) * HEALTH_PER_LEVEL;
            return [
                { label: 'Base', value: HEALTH_BASE },
                { label: 'Strength', value: fromStrength },
                { label: 'Level', value: fromLevel },
                { label: 'Equipment', value: equipment },
                { label: 'Talents', value: talents },
                { label: 'Total', value: HEALTH_BASE + fromStrength + fromLevel + equipment + talents },
            ];
        }
        case 'defense':
            return sqrtBreakdown(DEFENSE_BASE, DEFENSE_PER_SQRT_DEXTERITY, 'dexterity', dexterity, equipment, talents);
        case 'energy':
            return sqrtBreakdown(ENERGY_BASE, ENERGY_PER_SQRT_INTELLIGENCE, 'intelligence', intelligence, equipment, talents);
        case 'attack': {
            const cls = CLASSES[player.classId];
            const base = cls?.baseAttack ?? 0;
            const rows = [{ label: 'Base (Class)', value: base }];
            let total = base;

            if (cls?.primaryAttribute) {
                const primary = Math.round(attackAttributeContributionRaw(effectiveAttributes[cls.primaryAttribute]));
                rows.push({ label: ATTRIBUTE_LABELS[cls.primaryAttribute], value: primary });
                total += primary;
            }

            const subclass = player.subclass ? SUBCLASSES[player.subclass] : null;
            if (subclass) {
                const secondary = Math.round(0.5 * attackAttributeContributionRaw(effectiveAttributes[subclass.secondaryAttribute]));
                rows.push({ label: `${ATTRIBUTE_LABELS[subclass.secondaryAttribute]} (secondary)`, value: secondary });
                total += secondary;
            }

            rows.push({ label: 'Equipment', value: equipment }, { label: 'Talents', value: talents }, { label: 'Total', value: total + equipment + talents });
            return rows;
        }
        case 'carryCapacity':
            return sqrtBreakdown(CAPACITY_BASE, CAPACITY_PER_SQRT_STRENGTH, 'strength', strength, equipment, talents);
        case 'speed': {
            const total = speedFor(dexterity) + equipment;
            const fromDexterity = total - 1 - equipment - talents;
            return [
                { label: 'Base', value: 1 },
                { label: 'Dexterity', value: fromDexterity },
                { label: 'Equipment', value: equipment },
                { label: 'Talents', value: talents },
                { label: 'Total', value: total },
            ];
        }
        case 'acuity':
            return sqrtBreakdown(ACUITY_BASE, ACUITY_PER_SQRT_INTELLIGENCE, 'intelligence', intelligence, equipment, talents);
        case 'fire':
        case 'lightning':
        case 'arcane':
        case 'blunt':
        case 'slash':
        case 'pierce': {
            // Magic and physical resistances share the same strength/
            // dexterity/intelligence governing pattern (see
            // STAT_GOVERNING_ATTRIBUTE in src/data/armorTypes.js).
            const RESISTANCE_ATTRIBUTE = {
                fire: 'strength',
                lightning: 'dexterity',
                arcane: 'intelligence',
                blunt: 'strength',
                slash: 'dexterity',
                pierce: 'intelligence',
            };
            const attributeKey = RESISTANCE_ATTRIBUTE[key];
            const fromAttribute = effectiveAttributes[attributeKey];
            return [
                { label: ATTRIBUTE_LABELS[attributeKey], value: fromAttribute },
                { label: 'Equipment', value: equipment },
                { label: 'Talents', value: talents },
                { label: 'Total', value: fromAttribute + equipment + talents },
            ];
        }
        default:
            return null;
    }
}
