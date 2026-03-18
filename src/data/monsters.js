/**
 * monsters.js - Monster definitions
 *
 * Each entry is keyed by monster name and contains:
 *   image_def  — visual descriptor used by the texture generator
 *   base_stats — STR/DEX/INT used to calculate derived stats
 *   loot       — items carried; each { name: string }
 */

export const MONSTER_DEFS = {

  goblin: {
    image_def: {
      bodyColor:   0x3a7a3a,
      accentColor: 0xffcc44,
      bodyW:  10, bodyH:  12,
      headW:  10, headH:   9,
      earType: 'pointy',
      tusks:   false,
    },
    base_stats: { strength: 6, dexterity: 10, intelligence: 4 },
    loot: [{ name: 'Rusty Dagger' }],
  },

  orc: {
    image_def: {
      bodyColor:   0x4a6e2a,
      accentColor: 0xff4444,
      bodyW:  18, bodyH:  16,
      headW:  14, headH:  10,
      earType: 'wide',
      tusks:   true,
    },
    base_stats: { strength: 12, dexterity: 6, intelligence: 3 },
    loot: [{ name: 'Broken Sword' }],
  },

  skeleton: {
    image_def: {
      bodyColor:   0xd4c89a,
      accentColor: 0x0044ff,
      bodyW:  10, bodyH:  14,
      headW:   9, headH:   9,
      earType: 'none',
      tusks:   false,
    },
    base_stats: { strength: 4, dexterity: 8, intelligence: 6 },
    loot: [{ name: 'Bone Shard' }],
  },

};
