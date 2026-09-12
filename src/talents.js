import { randomInt, randomUUID } from 'node:crypto';
import { mkdir, readFile, rename, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const sourceDir = path.dirname(fileURLToPath(import.meta.url));
const dataDir = path.resolve(sourceDir, '../data');
const talentFile = path.join(dataDir, 'talents.json');
const assignmentFile = path.join(dataDir, 'assignments.json');
const boostFile = path.join(dataDir, 'rarity-boosts.json');
const emojiFile = path.join(dataDir, 'rarity-emojis.json');
const profileFile = path.join(dataDir, 'profiles.json');
const pendingFile = path.join(dataDir, 'pending-talents.json');
const burnedFile = path.join(dataDir, 'burned-talents.json');
const selectionFile = path.join(dataDir, 'roll-selections.json');
const raceFile = path.join(dataDir, 'races.json');

export const DEFAULT_RACES = [
  'Human', 'Dwarf', 'Elf', 'High Elf', 'Beastman', 'Lizardman', 'Goblin', 'Hobgoblin',
  'Orc', 'Ogre', 'Kijin', 'Dragonewt', 'Direwolf', 'Slime', 'Demon', 'Vampire',
  'Angel', 'Spirit', 'Insectar', 'True Dragon', 'True Giant',
];

const defaultMinTier = { common: 1, uncommon: 2, rare: 3, epic: 4, legendary: 5 };
const raceSkillRequirements = {
  absorption: ['Slime'], dissolve: ['Slime'], predator: ['Slime'], selfregeneration: ['Slime', 'Vampire'],
  beastbody: ['Beastman', 'Direwolf'], beastdomination: ['Beastman'], beastunification: ['Beastman'], beastialize: ['Beastman'],
  bloodraise: ['Vampire'], darknightcycle: ['Vampire'], possess: ['Vampire'], charm: ['Vampire'],
  dragonbody: ['True Dragon'], dragonchange: ['True Dragon'], dragoneye: ['True Dragon'], dragonscales: ['True Dragon'], dragonskin: ['True Dragon'], dragonspirithaki: ['True Dragon'],
  magicnullification: ['True Giant'], pseudodragonbody: ['Dragonewt'], scalearmor: ['Dragonewt'], flamebreath: ['Dragonewt'], thunderbreath: ['Dragonewt'],
  ultrasmell: ['Direwolf'], shadowmotion: ['Direwolf', 'Vampire'], godwolfsense: ['Direwolf'],
  ogreberserker: ['Ogre', 'Kijin'], blackflamethunder: ['Ogre', 'Kijin'],
  plantwhisper: ['Spirit'], universalthread: ['Insectar'], stickythread: ['Insectar'], steelthread: ['Insectar'],
};

const skillKey = (name) => name.toLowerCase().replace(/[^a-z0-9]/g, '');
const raceKey = (name) => name.trim().toLowerCase();

export const STARTER_TALENTS = [
  { name: 'Footwork Technique', category: 'Innate', rarity: 'common', weight: 32, description: 'Training in evasive movement and rapid changes of position.' },
  { name: 'Sword Aura', category: 'Combat', rarity: 'common', weight: 28, description: 'Can manifest mana through a bladed weapon as a cutting aura.' },
  { name: 'Acidic Magic', category: 'Magic', rarity: 'uncommon', weight: 18, description: 'Casts corrosive magic that weakens material targets and defenses.' },
  { name: 'Mana Weapon Proficiency', category: 'Profession', rarity: 'uncommon', weight: 16, description: 'Can channel magical power through a mana weapon with reliable control.' },
  { name: 'Ice Spike', category: 'Magic', rarity: 'uncommon', weight: 14, description: 'Forms and launches compact spikes of ice using mana.' },
  { name: 'Jugasibili', category: 'Combat', rarity: 'rare', weight: 8, description: 'A stolen martial technique used for agile evasive movement.' },
  { name: 'Shadow Step', category: 'Combat', rarity: 'rare', weight: 7, description: 'Mana-based acceleration and repositioning used in close combat.' },
  { name: 'Wavecut Execution', category: 'Combat', rarity: 'rare', weight: 6, description: 'A forceful mana technique that drives a direct, wave-like assault.' },
  { name: 'Sharpshooter', category: 'Combat', rarity: 'epic', weight: 3, description: 'A martial art centered on reading an opponent’s movements and patterns.' },
  { name: 'Necromancy', category: 'Magic', rarity: 'legendary', weight: 1, description: 'Magic associated with undead and death-aligned supernatural forces.' }
];

const defaultCategories = Object.fromEntries(STARTER_TALENTS.map((talent) => [talent.name, talent.category]));

async function ensureDataFile(file, fallback) {
  await mkdir(dataDir, { recursive: true });
  try {
    return JSON.parse(await readFile(file, 'utf8'));
  } catch (error) {
    if (error.code !== 'ENOENT') throw error;
    await writeJson(file, fallback);
    return fallback;
  }
}

async function writeJson(file, value) {
  await mkdir(dataDir, { recursive: true });
  const temporary = `${file}.tmp`;
  await writeFile(temporary, `${JSON.stringify(value, null, 2)}\n`, 'utf8');
  await rename(temporary, file);
}

export async function getTalents() {
  const talents = await ensureDataFile(talentFile, STARTER_TALENTS);
  return talents.map((talent) => ({
    ...talent,
    category: talent.category ?? defaultCategories[talent.name] ?? 'Innate',
    minTier: Math.max(1, Math.min(5, Number(talent.minTier) || defaultMinTier[talent.rarity] || 1)),
    races: Array.isArray(talent.races) ? talent.races : (raceSkillRequirements[skillKey(talent.name)] ?? []),
  }));
}

export async function addTalent(talent) {
  const talents = await getTalents();
  if (talents.some((item) => item.name.toLowerCase() === talent.name.toLowerCase())) {
    throw new Error('A talent with that name already exists.');
  }
  talents.push(talent);
  await writeJson(talentFile, talents);
  return talent;
}

export async function removeTalent(name) {
  const talents = await getTalents();
  const index = talents.findIndex((item) => item.name.toLowerCase() === name.toLowerCase());
  if (index === -1) throw new Error('No talent with that name exists.');
  const [removed] = talents.splice(index, 1);
  await writeJson(talentFile, talents);
  return removed;
}

export async function updateTalent(name, updates) {
  const talents = await getTalents();
  const index = talents.findIndex((item) => item.name.toLowerCase() === name.toLowerCase());
  if (index === -1) throw new Error('No talent with that name exists.');
  const nextName = updates.name ?? talents[index].name;
  if (talents.some((item, itemIndex) => itemIndex !== index && item.name.toLowerCase() === nextName.toLowerCase())) {
    throw new Error('Another talent already uses that name.');
  }
  talents[index] = { ...talents[index], ...updates, name: nextName };
  await writeJson(talentFile, talents);
  return talents[index];
}

export async function weightedRoll({ milestone = false, boostLevel = 0, excludedNames = [], rarity, race = 'Unassigned', tier = 1 } = {}) {
  const talents = await getTalents();
  const excluded = new Set(excludedNames.map((name) => name.toLowerCase()));
  const characterTier = Math.max(1, Math.min(5, Number.parseInt(tier, 10) || 1));
  const characterRace = raceKey(race);
  const adjustedTalents = talents.filter((talent) =>
    !excluded.has(talent.name.toLowerCase())
      && (!rarity || talent.rarity === rarity)
      && talent.minTier <= characterTier
      && (talent.races.length === 0 || talent.races.some((allowedRace) => raceKey(allowedRace) === characterRace)),
  ).map((talent) => ({
    ...talent,
    weight: adjustedWeight(talent, milestone, boostLevel),
  }));
  const totalWeight = adjustedTalents.reduce((sum, talent) => sum + talent.weight, 0);
  if (!totalWeight) throw new Error(`No eligible ${rarity ? `${rarity} ` : ''}skills exist for ${race} at Tier ${characterTier}.`);
  let point = randomInt(totalWeight);
  for (const talent of adjustedTalents) {
    point -= talent.weight;
    if (point < 0) return talent;
  }
  throw new Error('Could not select a talent. Check the pool weights.');
}

export async function getRaces(guildId) {
  const races = await ensureDataFile(raceFile, {});
  return races?.[guildId] ?? DEFAULT_RACES;
}

export async function addRace(guildId, name) {
  const races = await ensureDataFile(raceFile, {});
  const existing = races[guildId] ?? DEFAULT_RACES;
  if (existing.some((race) => raceKey(race) === raceKey(name))) throw new Error('That race is already available.');
  races[guildId] = [...existing, name.trim()];
  await writeJson(raceFile, races);
  return races[guildId];
}

export async function removeRace(guildId, name) {
  const races = await ensureDataFile(raceFile, {});
  const existing = races[guildId] ?? DEFAULT_RACES;
  const next = existing.filter((race) => raceKey(race) !== raceKey(name));
  if (next.length === existing.length) return false;
  races[guildId] = next;
  await writeJson(raceFile, races);
  return true;
}

function adjustedWeight(talent, milestone, boostLevel) {
  const milestoneMultiplier = milestone
    ? { common: 0.6, uncommon: 1.35, rare: 2, epic: 3, legendary: 4 }[talent.rarity] ?? 1
    : 1;
  // An admin boost progressively favors higher rarities and is used once.
  const manualMultiplier = boostLevel > 0
    ? {
      common: Math.max(0.35, 1 - (boostLevel * 0.13)),
      uncommon: 1 + (boostLevel * 0.2),
      rare: 1 + (boostLevel * 0.45),
      epic: 1 + (boostLevel * 0.75),
      legendary: 1 + boostLevel,
    }[talent.rarity] ?? 1
    : 1;
  return Math.max(1, Math.round(talent.weight * milestoneMultiplier * manualMultiplier));
}

export async function getRarityBoost(guildId, userId) {
  const boosts = await ensureDataFile(boostFile, {});
  return boosts?.[guildId]?.[userId] ?? 0;
}

export async function grantRarityBoost(guildId, userId, level) {
  const boosts = await ensureDataFile(boostFile, {});
  boosts[guildId] ??= {};
  boosts[guildId][userId] = Math.min(5, Math.max(boosts[guildId][userId] ?? 0, level));
  await writeJson(boostFile, boosts);
  return boosts[guildId][userId];
}

export async function consumeRarityBoost(guildId, userId) {
  const boosts = await ensureDataFile(boostFile, {});
  const level = boosts?.[guildId]?.[userId] ?? 0;
  if (level > 0) {
    delete boosts[guildId][userId];
    await writeJson(boostFile, boosts);
  }
  return level;
}

export async function getRarityEmojis(guildId) {
  const emojis = await ensureDataFile(emojiFile, {});
  return emojis?.[guildId] ?? {};
}

export async function setRarityEmoji(guildId, rarity, emoji) {
  const emojis = await ensureDataFile(emojiFile, {});
  emojis[guildId] ??= {};
  emojis[guildId][rarity] = emoji;
  await writeJson(emojiFile, emojis);
  return emoji;
}

export async function getProfile(guildId, userId) {
  const profiles = await ensureDataFile(profileFile, {});
  return { level: '0', tier: 'Unranked', race: 'Unassigned', class: 'Unassigned', ...(profiles?.[guildId]?.[userId] ?? {}) };
}

export async function setProfile(guildId, userId, updates) {
  const profiles = await ensureDataFile(profileFile, {});
  profiles[guildId] ??= {};
  profiles[guildId][userId] = { ...(await getProfile(guildId, userId)), ...updates };
  await writeJson(profileFile, profiles);
  return profiles[guildId][userId];
}

export async function getPendingTalents(guildId, userId) {
  const pending = await ensureDataFile(pendingFile, {});
  return pending?.[guildId]?.[userId] ?? [];
}

export async function addPendingTalents(guildId, userId, talents, batchId = randomUUID()) {
  const pending = await ensureDataFile(pendingFile, {});
  pending[guildId] ??= {};
  pending[guildId][userId] ??= [];
  const entries = talents.map((talent) => ({ id: randomUUID(), batchId, talent, state: 'pending', rolledAt: new Date().toISOString() }));
  pending[guildId][userId].push(...entries);
  await writeJson(pendingFile, pending);
  return entries;
}

export async function resolvePendingTalent(guildId, userId, entryId, action) {
  const pending = await ensureDataFile(pendingFile, {});
  const entries = pending?.[guildId]?.[userId] ?? [];
  const index = entries.findIndex((entry) => entry.id === entryId);
  if (index === -1) throw new Error('That talent card is no longer available.');
  const [entry] = entries.splice(index, 1);
  if (action === 'freeze') {
    entry.state = 'frozen';
    entries.push(entry);
  }
  pending[guildId] ??= {};
  pending[guildId][userId] = entries;
  await writeJson(pendingFile, pending);
  if (action === 'burn') {
    const burned = await ensureDataFile(burnedFile, {});
    burned[guildId] ??= {};
    burned[guildId][userId] ??= [];
    if (!burned[guildId][userId].some((name) => name.toLowerCase() === entry.talent.name.toLowerCase())) {
      burned[guildId][userId].push(entry.talent.name);
      await writeJson(burnedFile, burned);
    }
  }
  return entry;
}

export async function getBurnedTalents(guildId, userId) {
  const burned = await ensureDataFile(burnedFile, {});
  return burned?.[guildId]?.[userId] ?? [];
}

export async function getBatchSavedCount(guildId, userId, batchId) {
  const selections = await ensureDataFile(selectionFile, {});
  return selections?.[guildId]?.[userId]?.[batchId] ?? 0;
}

export async function recordBatchSave(guildId, userId, batchId) {
  const selections = await ensureDataFile(selectionFile, {});
  selections[guildId] ??= {};
  selections[guildId][userId] ??= {};
  selections[guildId][userId][batchId] = (selections[guildId][userId][batchId] ?? 0) + 1;
  await writeJson(selectionFile, selections);
  return selections[guildId][userId][batchId];
}

export async function getAssignment(guildId, userId) {
  const assignments = await ensureDataFile(assignmentFile, {});
  const assignment = assignments?.[guildId]?.[userId];
  if (!assignment) return [];
  // Makes the bot compatible with any one-talent rolls saved before the multi-roll update.
  return Array.isArray(assignment) ? assignment : [assignment];
}

export async function addAssignments(guildId, userId, talents) {
  const assignments = await ensureDataFile(assignmentFile, {});
  assignments[guildId] ??= {};
  const existing = assignments[guildId][userId];
  const previousTalents = !existing ? [] : Array.isArray(existing) ? existing : [existing];
  assignments[guildId][userId] = [
    ...previousTalents,
    ...talents.map((talent) => ({ ...talent, rolledAt: new Date().toISOString() })),
  ];
  await writeJson(assignmentFile, assignments);
  return assignments[guildId][userId];
}

export async function clearAssignment(guildId, userId) {
  const assignments = await ensureDataFile(assignmentFile, {});
  if (!assignments?.[guildId]?.[userId]) return false;
  delete assignments[guildId][userId];
  await writeJson(assignmentFile, assignments);
  return true;
}

export async function removeAssignment(guildId, userId, name) {
  const assignments = await ensureDataFile(assignmentFile, {});
  const existing = assignments?.[guildId]?.[userId];
  if (!existing) return null;
  const skills = Array.isArray(existing) ? existing : [existing];
  const index = skills.findIndex((skill) => skill.name.toLowerCase() === name.toLowerCase());
  if (index === -1) return null;
  const [removed] = skills.splice(index, 1);
  if (skills.length === 0) delete assignments[guildId][userId];
  else assignments[guildId][userId] = skills;
  await writeJson(assignmentFile, assignments);
  return removed;
}
