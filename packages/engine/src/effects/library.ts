import type { TriggeredEffect } from '../types/card';
import { effects as OP01_001 } from './cards/OP01-001';
import { effects as OP01_005 } from './cards/OP01-005';
import { effects as OP01_006 } from './cards/OP01-006';
import { effects as OP01_007 } from './cards/OP01-007';
import { effects as OP01_009 } from './cards/OP01-009';
import { effects as OP01_014 } from './cards/OP01-014';
import { effects as OP01_015 } from './cards/OP01-015';
import { effects as OP01_016 } from './cards/OP01-016';
import { effects as OP01_017 } from './cards/OP01-017';
import { effects as OP01_019 } from './cards/OP01-019';
import { effects as OP01_020 } from './cards/OP01-020';
import { effects as OP01_021 } from './cards/OP01-021';
import { effects as OP01_022 } from './cards/OP01-022';
import { effects as OP01_025 } from './cards/OP01-025';
import { effects as OP01_026 } from './cards/OP01-026';
import { effects as OP01_027 } from './cards/OP01-027';
import { effects as OP01_028 } from './cards/OP01-028';
import { effects as OP01_029 } from './cards/OP01-029';
import { effects as OP01_030 } from './cards/OP01-030';
import { effects as OP01_032 } from './cards/OP01-032';
import { effects as OP01_033 } from './cards/OP01-033';
import { effects as OP01_034 } from './cards/OP01-034';
import { effects as OP01_038 } from './cards/OP01-038';
import { effects as OP01_039 } from './cards/OP01-039';
import { effects as OP01_040 } from './cards/OP01-040';
import { effects as OP01_041 } from './cards/OP01-041';
import { effects as OP01_042 } from './cards/OP01-042';
import { effects as OP01_044 } from './cards/OP01-044';
import { effects as OP01_046 } from './cards/OP01-046';
import { effects as OP01_047 } from './cards/OP01-047';
import { effects as OP01_048 } from './cards/OP01-048';
import { effects as OP01_049 } from './cards/OP01-049';
import { effects as OP01_050 } from './cards/OP01-050';
import { effects as OP01_054 } from './cards/OP01-054';
import { effects as OP01_055 } from './cards/OP01-055';
import { effects as OP01_056 } from './cards/OP01-056';
import { effects as OP01_057 } from './cards/OP01-057';
import { effects as OP01_058 } from './cards/OP01-058';
import { effects as OP01_059 } from './cards/OP01-059';
import { effects as OP01_063 } from './cards/OP01-063';
import { effects as OP01_064 } from './cards/OP01-064';
import { effects as OP01_067 } from './cards/OP01-067';
import { effects as OP01_068 } from './cards/OP01-068';
import { effects as OP01_069 } from './cards/OP01-069';
import { effects as OP01_070 } from './cards/OP01-070';
import { effects as OP01_071 } from './cards/OP01-071';
import { effects as OP01_072 } from './cards/OP01-072';
import { effects as OP01_073 } from './cards/OP01-073';
import { effects as OP01_074 } from './cards/OP01-074';
import { effects as OP01_077 } from './cards/OP01-077';
import { effects as OP01_078 } from './cards/OP01-078';
import { effects as OP01_079 } from './cards/OP01-079';
import { effects as OP01_080 } from './cards/OP01-080';
import { effects as OP01_083 } from './cards/OP01-083';
import { effects as OP01_084 } from './cards/OP01-084';
import { effects as OP01_085 } from './cards/OP01-085';
import { effects as OP01_086 } from './cards/OP01-086';
import { effects as OP01_087 } from './cards/OP01-087';
import { effects as OP01_088 } from './cards/OP01-088';
import { effects as OP01_089 } from './cards/OP01-089';
import { effects as OP01_090 } from './cards/OP01-090';
import { effects as OP01_091 } from './cards/OP01-091';
import { effects as OP01_093 } from './cards/OP01-093';
import { effects as OP01_094 } from './cards/OP01-094';
import { effects as OP01_095 } from './cards/OP01-095';
import { effects as OP01_096 } from './cards/OP01-096';
import { effects as OP01_097 } from './cards/OP01-097';
import { effects as OP01_098 } from './cards/OP01-098';
import { effects as OP01_099 } from './cards/OP01-099';
import { effects as OP01_101 } from './cards/OP01-101';
import { effects as OP01_102 } from './cards/OP01-102';
import { effects as OP01_105 } from './cards/OP01-105';
import { effects as OP01_106 } from './cards/OP01-106';
import { effects as OP01_108 } from './cards/OP01-108';
import { effects as OP01_109 } from './cards/OP01-109';
import { effects as OP01_111 } from './cards/OP01-111';
import { effects as OP01_113 } from './cards/OP01-113';
import { effects as OP01_114 } from './cards/OP01-114';
import { effects as OP01_115 } from './cards/OP01-115';
import { effects as OP01_116 } from './cards/OP01-116';
import { effects as OP01_117 } from './cards/OP01-117';
import { effects as OP01_118 } from './cards/OP01-118';
import { effects as OP01_119 } from './cards/OP01-119';
import { effects as OP01_120 } from './cards/OP01-120';
import { effects as OP01_121 } from './cards/OP01-121';

/**
 * Per-card effect overrides keyed by cardId.
 * Hand-coded library — see helpers.ts for terse constructors.
 */
export const CARD_EFFECT_LIBRARY: Readonly<Record<string, TriggeredEffect[]>> = Object.freeze({
  'OP01-001': OP01_001,
  'OP01-005': OP01_005,
  'OP01-006': OP01_006,
  'OP01-007': OP01_007,
  'OP01-009': OP01_009,
  'OP01-014': OP01_014,
  'OP01-015': OP01_015,
  'OP01-016': OP01_016,
  'OP01-017': OP01_017,
  'OP01-019': OP01_019,
  'OP01-020': OP01_020,
  'OP01-021': OP01_021,
  'OP01-022': OP01_022,
  'OP01-025': OP01_025,
  'OP01-026': OP01_026,
  'OP01-027': OP01_027,
  'OP01-028': OP01_028,
  'OP01-029': OP01_029,
  'OP01-030': OP01_030,
  'OP01-032': OP01_032,
  'OP01-033': OP01_033,
  'OP01-034': OP01_034,
  'OP01-038': OP01_038,
  'OP01-039': OP01_039,
  'OP01-040': OP01_040,
  'OP01-041': OP01_041,
  'OP01-042': OP01_042,
  'OP01-044': OP01_044,
  'OP01-046': OP01_046,
  'OP01-047': OP01_047,
  'OP01-048': OP01_048,
  'OP01-049': OP01_049,
  'OP01-050': OP01_050,
  'OP01-054': OP01_054,
  'OP01-055': OP01_055,
  'OP01-056': OP01_056,
  'OP01-057': OP01_057,
  'OP01-058': OP01_058,
  'OP01-059': OP01_059,
  'OP01-063': OP01_063,
  'OP01-064': OP01_064,
  'OP01-067': OP01_067,
  'OP01-068': OP01_068,
  'OP01-069': OP01_069,
  'OP01-070': OP01_070,
  'OP01-071': OP01_071,
  'OP01-072': OP01_072,
  'OP01-073': OP01_073,
  'OP01-074': OP01_074,
  'OP01-077': OP01_077,
  'OP01-078': OP01_078,
  'OP01-079': OP01_079,
  'OP01-080': OP01_080,
  'OP01-083': OP01_083,
  'OP01-084': OP01_084,
  'OP01-085': OP01_085,
  'OP01-086': OP01_086,
  'OP01-087': OP01_087,
  'OP01-088': OP01_088,
  'OP01-089': OP01_089,
  'OP01-090': OP01_090,
  'OP01-091': OP01_091,
  'OP01-093': OP01_093,
  'OP01-094': OP01_094,
  'OP01-095': OP01_095,
  'OP01-096': OP01_096,
  'OP01-097': OP01_097,
  'OP01-098': OP01_098,
  'OP01-099': OP01_099,
  'OP01-101': OP01_101,
  'OP01-102': OP01_102,
  'OP01-105': OP01_105,
  'OP01-106': OP01_106,
  'OP01-108': OP01_108,
  'OP01-109': OP01_109,
  'OP01-111': OP01_111,
  'OP01-113': OP01_113,
  'OP01-114': OP01_114,
  'OP01-115': OP01_115,
  'OP01-116': OP01_116,
  'OP01-117': OP01_117,
  'OP01-118': OP01_118,
  'OP01-119': OP01_119,
  'OP01-120': OP01_120,
  'OP01-121': OP01_121,
});

export function getEffectsForCard(cardId: string): TriggeredEffect[] {
  return CARD_EFFECT_LIBRARY[cardId] ?? [];
}
