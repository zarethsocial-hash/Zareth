import 'dotenv/config';
import { ActionRowBuilder, ButtonBuilder, ButtonStyle, Client, EmbedBuilder, Events, GatewayIntentBits, PermissionFlagsBits, StringSelectMenuBuilder } from 'discord.js';
import { commands } from './commands.js';
import { addAssignments, addPendingTalents, addRace, addTalent, clearAssignment, consumeRarityBoost, getAssignment, getBatchSavedCount, getBurnedTalents, getPendingTalents, getProfile, getRaces, getRarityEmojis, getTalents, grantRarityBoost, recordBatchSave, removeAssignment, removeRace, removeTalent, resolvePendingTalent, setProfile, setRarityEmoji, updateTalent, weightedRoll } from './talents.js';

const token = process.env.DISCORD_TOKEN;
if (!token) throw new Error('DISCORD_TOKEN is missing. Copy .env.example to .env and add your bot token.');

const client = new Client({ intents: [GatewayIntentBits.Guilds] });
const colors = { common: 0x95a5a6, uncommon: 0x2ecc71, rare: 0x3498db, epic: 0x9b59b6, legendary: 0xf1c40f };
const rarityStyle = {
  common: { glow: '<:Extra_Skill:1546348854918512690>', label: 'Common Skill', rank: 1 },
  uncommon: { glow: '<:Common_Skill:1546348849436557372>', label: 'Extra Skill', rank: 2 },
  rare: { glow: '<:Intrinsic_skill:1546348846559273040>', label: 'Intrinsic Skill', rank: 3 },
  epic: { glow: '<:Unique_Skill:1546348843753279528>', label: 'Unique Skill', rank: 4 },
  legendary: { glow: '<:Ultimate_Skill:1546348858538328094>', label: 'Ultimate Skill', rank: 5 },
};
const cardSelections = new Map();
const MAX_SAVES_PER_ROLL = 2;
const TALENTS_PER_POOL_PAGE = 10;
const mainHeader = (text) => `<:supportgear:1546350366394945576> ${text}`;
const talentDescription = (text) => `-# <:RA_2:1546347972411789403> ${text}`;
const parseRaceList = (value) => !value || value.trim().toLowerCase() === 'all' ? [] : value.split(',').map((race) => race.trim()).filter(Boolean);
const sameRace = (left, right) => left.trim().toLowerCase() === right.trim().toLowerCase();

function talentEmbed(talent, title = 'Skill acquired', customEmojis = {}) {
  const style = rarityStyle[talent.rarity] ?? rarityStyle.common;
  return new EmbedBuilder()
    .setTitle(mainHeader(title))
    .setColor(colors[talent.rarity] ?? 0x5865f2)
    .addFields(
      { name: 'Skill', value: talent.name, inline: true },
      { name: 'Rarity', value: `${customEmojis[talent.rarity] ?? style.glow} ${style.label}`, inline: true },
      { name: 'Description', value: talentDescription(talent.description) },
    );
}

function talentListEmbed(talents, title, customEmojis = {}) {
  const shownTalents = talents.slice(-20);
  const highestRarity = getHighestRarity(shownTalents);
  const description = formatTalentGroups(shownTalents, customEmojis, (talent) => talent, (talent) => `\n${talentDescription(talent.description)}`);
  const omitted = talents.length > shownTalents.length ? `\n\n*Showing the most recent 20 of ${talents.length} skills.*` : '';
  const topStyle = rarityStyle[highestRarity] ?? rarityStyle.common;
  return new EmbedBuilder()
    .setTitle(mainHeader(title))
    .setDescription(`${description}${omitted}`)
    .setColor(colors[highestRarity] ?? 0x5865f2)
    .setFooter({ text: `Highest rarity: ${topStyle.label}` });
}

function getHighestRarity(talents) {
  return talents.reduce((highest, talent) => {
    const currentStyle = rarityStyle[talent.rarity] ?? rarityStyle.common;
    const highestStyle = rarityStyle[highest] ?? rarityStyle.common;
    return currentStyle.rank > highestStyle.rank ? talent.rarity : highest;
  }, 'common');
}

function categoryDisplay(category) {
  switch ((category ?? 'Innate').toLowerCase()) {
    case 'magic':
      return { key: 'magic', label: 'Magic', heading: '<:energy:1546348006763397191> **𝗠𝗔𝗚𝗜𝗖**' };
    case 'combat':
      return { key: 'martial-arts', label: 'Martial Arts', heading: '<:martial:1546348023964246126> **𝗠𝗔𝗥𝗧𝗜𝗔𝗟 𝗔𝗥𝗧𝗦**' };
    case 'innate':
    case 'profession':
      return { key: 'varied', label: 'Varied', heading: '<:AT_Masks:1546347959480881264> **𝗩𝗔𝗥𝗜𝗘𝗗**' };
    default:
      return { key: category.toLowerCase(), label: category, heading: `🧬 **${category.toUpperCase()}**` };
  }
}

function formatTalentLine(talent, customEmojis = {}, suffix = '') {
  const style = rarityStyle[talent.rarity] ?? rarityStyle.common;
  const emoji = customEmojis[talent.rarity] ?? style.glow;
  const period = /[.!?]$/.test(talent.name) ? '' : '.';
  return `**Skills** | ${emoji} | __**[\`${style.label}\`]**__ **${talent.name}**${period}${suffix}`;
}

function formatTalentGroups(items, customEmojis = {}, getTalent = (item) => item, getSuffix = () => '') {
  const groupedTalents = new Map();
  for (const item of items) {
    const talent = getTalent(item);
    const display = categoryDisplay(talent.category ?? 'Innate');
    const group = groupedTalents.get(display.key) ?? { display, items: [] };
    group.items.push(item);
    groupedTalents.set(display.key, group);
  }
  return [...groupedTalents.values()].map(({ display, items: groupItems }) =>
    `\n${display.heading}\n${groupItems.map((item) => formatTalentLine(getTalent(item), customEmojis, getSuffix(item))).join('\n')}`,
  ).join('\n');
}

function talentCardEmbed(member, profile, collection, pendingTalents, customEmojis = {}) {
  const highestRarity = getHighestRarity([...collection, ...pendingTalents.map((entry) => entry.talent)]);
  const topStyle = rarityStyle[highestRarity] ?? rarityStyle.common;
  const topEmoji = customEmojis[highestRarity] ?? topStyle.glow;
  const talentLines = formatTalentGroups(
    pendingTalents.slice(-20),
    customEmojis,
    (entry) => entry.talent,
    (entry) => entry.state === 'frozen' ? ' ❄️' : '',
  );
  return new EmbedBuilder()
    .setDescription(
      `${mainHeader('__**𝗦𝗞𝗜𝗟𝗟 𝗖𝗔𝗥𝗗 𝗥𝗘𝗥𝗢𝗟𝗟**__')}\n\n**Member**　　　　**Level**　　　　**Tier**　　　　**Race**\n<@${member.id}>　　　　\`${profile.level}\`　　　　\`${profile.tier}\`　　　　${profile.race}\n\n${talentLines || '*No pending skills.*'}\n\n*Class: ${profile.class} • Saved skills: ${collection.length}*`,
    )
    .setColor(colors[highestRarity] ?? 0x5865f2)
    .setFooter({ text: `Highest rarity: ${topStyle.label}` });
}

function talentCardControls(memberId, batchId, pendingTalents, savedCount = 0) {
  const options = pendingTalents.slice(-25).map((entry) => {
    const style = rarityStyle[entry.talent.rarity] ?? rarityStyle.common;
    return {
      label: `${entry.talent.name} • ${style.label}`.slice(0, 100),
      value: entry.id,
      description: `${entry.talent.category ?? 'Innate'}${entry.state === 'frozen' ? ' • Frozen' : ''}`.slice(0, 100),
    };
  });
  const rows = [];
  if (options.length) {
    rows.push(new ActionRowBuilder().addComponents(
      new StringSelectMenuBuilder()
        .setCustomId(`talent-pick:${memberId}:${batchId}`)
        .setPlaceholder('Select a skill, then choose Save, Burn, or Freeze')
        .addOptions(options),
    ));
  }
  rows.push(new ActionRowBuilder().addComponents(
    new ButtonBuilder().setCustomId(`talent-act:save1:${memberId}:${batchId}`).setLabel('Save Slot 1').setStyle(ButtonStyle.Primary).setDisabled(!options.length || savedCount >= 1),
    new ButtonBuilder().setCustomId(`talent-act:save2:${memberId}:${batchId}`).setLabel('Save Slot 2').setStyle(ButtonStyle.Primary).setDisabled(!options.length || savedCount < 1 || savedCount >= MAX_SAVES_PER_ROLL),
    new ButtonBuilder().setCustomId(`talent-act:burn:${memberId}:${batchId}`).setLabel('Burn').setStyle(ButtonStyle.Danger).setDisabled(!options.length),
    new ButtonBuilder().setCustomId(`talent-act:freeze:${memberId}:${batchId}`).setLabel('Freeze').setStyle(ButtonStyle.Secondary).setDisabled(!options.length),
  ));
  return rows;
}

function profileEmbed(member, profile, talents, customEmojis = {}) {
  const highestRarity = getHighestRarity(talents);
  const style = rarityStyle[highestRarity] ?? rarityStyle.common;
  const emoji = customEmojis[highestRarity] ?? style.glow;
  const lines = formatTalentGroups(talents.slice(-20), customEmojis, (talent) => talent, (talent) => `\n${talentDescription(talent.description)}`);
  return new EmbedBuilder()
    .setTitle(mainHeader('• 𝗥𝗢𝗟𝗘𝗣𝗟𝗔𝗬 𝗣𝗥𝗢𝗙𝗜𝗟𝗘'))
    .addFields(
      { name: 'User', value: `<@${member.id}>`, inline: true },
      { name: 'Level', value: `\`${profile.level}\``, inline: true },
      { name: 'Tier', value: `\`${profile.tier}\``, inline: true },
      { name: 'Race', value: profile.race, inline: true },
      { name: 'Class', value: profile.class, inline: true },
    )
    .setDescription(`${mainHeader('**𝗦𝗔𝗩𝗘𝗗 𝗦𝗞𝗜𝗟𝗟𝗦**')}\n${lines || '*No saved skills yet.*'}`)
    .setColor(colors[highestRarity] ?? 0x5865f2);
}

function talentPoolEmbed(talents, customEmojis = {}, requestedPage = 0, rarity = null) {
  const pageCount = Math.max(1, Math.ceil(talents.length / TALENTS_PER_POOL_PAGE));
  const page = Math.min(Math.max(0, requestedPage), pageCount - 1);
  const pageTalents = talents.slice(page * TALENTS_PER_POOL_PAGE, (page + 1) * TALENTS_PER_POOL_PAGE);
  const description = formatTalentGroups(pageTalents, customEmojis, (talent) => talent, (talent) => ` • weight \`${talent.weight}\` • Tier \`${talent.minTier}\`${talent.races.length ? ` • ${talent.races.join(', ')}` : ''}\n${talentDescription(talent.description)}`);
  const filterLabel = rarity ? ` • ${(rarityStyle[rarity] ?? rarityStyle.common).label}` : '';
  return new EmbedBuilder()
    .setTitle(mainHeader('𝗦𝗞𝗜𝗟𝗟 𝗣𝗢𝗢𝗟'))
    .setDescription(description || '*The pool is empty.*')
    .setColor(0x5865f2)
    .setFooter({ text: `${talents.length} skill${talents.length === 1 ? '' : 's'}${filterLabel} • Page ${page + 1}/${pageCount} • Admin only` });
}

function talentPoolControls(page, talentCount, rarity = null) {
  const pageCount = Math.max(1, Math.ceil(talentCount / TALENTS_PER_POOL_PAGE));
  const filter = rarity ?? 'all';
  const rows = [];
  if (pageCount > 1) {
    rows.push(new ActionRowBuilder().addComponents(
      new ButtonBuilder().setCustomId(`talent-pool-page:${filter}:${page - 1}`).setLabel('Previous').setStyle(ButtonStyle.Secondary).setDisabled(page <= 0),
      new ButtonBuilder().setCustomId(`talent-pool-page:${filter}:${page + 1}`).setLabel('Next').setStyle(ButtonStyle.Primary).setDisabled(page >= pageCount - 1),
    ));
  }
  rows.push(new ActionRowBuilder().addComponents(
    new StringSelectMenuBuilder()
      .setCustomId('talent-pool-filter')
      .setPlaceholder('Filter the skill pool by rarity')
      .addOptions([
        { label: 'All Skills', value: 'all', default: filter === 'all' },
        ...Object.entries(rarityStyle).map(([value, style]) => ({ label: style.label, value, default: filter === value })),
      ]),
  ));
  return rows;
}

function isAdmin(interaction) {
  return interaction.memberPermissions?.has(PermissionFlagsBits.Administrator);
}

function canRollTalents(interaction) {
  return interaction.guild?.ownerId === interaction.user.id || isAdmin(interaction);
}

function canManageTalentCard(interaction, memberId) {
  return interaction.user.id === memberId || canRollTalents(interaction);
}

client.once(Events.ClientReady, async (readyClient) => {
  try {
    await Promise.all(readyClient.guilds.cache.map((guild) => guild.commands.set(commands)));
    console.log(`Ready as ${readyClient.user.tag}; refreshed commands in ${readyClient.guilds.cache.size} server(s).`);
  } catch (error) {
    console.error('Could not refresh server commands:', error);
  }
});

client.on(Events.InteractionCreate, async (interaction) => {
  if (!interaction.guildId) return;
  try {
    if (interaction.isStringSelectMenu() && interaction.customId.startsWith('talent-pick:')) {
      const [, memberId] = interaction.customId.split(':');
      if (!canManageTalentCard(interaction, memberId)) return interaction.reply({ content: 'Only this profile’s owner or an administrator can manage this skill card.', ephemeral: true });
      cardSelections.set(interaction.message.id, interaction.values[0]);
      return interaction.reply({ content: 'Skill selected. Choose **Save**, **Burn**, or **Freeze** below.', ephemeral: true });
    }

    if (interaction.isStringSelectMenu() && interaction.customId === 'talent-pool-filter') {
      if (!isAdmin(interaction)) return interaction.reply({ content: 'Only server administrators can view the skill pool.', ephemeral: true });
      const selected = interaction.values[0] ?? 'all';
      const rarity = selected === 'all' ? null : selected;
      const [allTalents, customEmojis] = await Promise.all([getTalents(), getRarityEmojis(interaction.guildId)]);
      const talents = rarity ? allTalents.filter((talent) => talent.rarity === rarity) : allTalents;
      return interaction.update({ embeds: [talentPoolEmbed(talents, customEmojis, 0, rarity)], components: talentPoolControls(0, talents.length, rarity) });
    }

    if (interaction.isButton() && interaction.customId.startsWith('talent-pool-page:')) {
      if (!isAdmin(interaction)) return interaction.reply({ content: 'Only server administrators can view the skill pool.', ephemeral: true });
      const [, , filter = 'all', rawPage] = interaction.customId.split(':');
      const requestedPage = Number(rawPage ?? filter);
      const rarity = rawPage && filter !== 'all' ? filter : null;
      const [allTalents, customEmojis] = await Promise.all([getTalents(), getRarityEmojis(interaction.guildId)]);
      const talents = rarity ? allTalents.filter((talent) => talent.rarity === rarity) : allTalents;
      const pageCount = Math.max(1, Math.ceil(talents.length / TALENTS_PER_POOL_PAGE));
      const page = Math.min(Math.max(0, Number.isInteger(requestedPage) ? requestedPage : 0), pageCount - 1);
      return interaction.update({ embeds: [talentPoolEmbed(talents, customEmojis, page, rarity)], components: talentPoolControls(page, talents.length, rarity) });
    }

    if (interaction.isButton() && interaction.customId.startsWith('talent-act:')) {
      const [, action, memberId, batchId] = interaction.customId.split(':');
      if (!canManageTalentCard(interaction, memberId)) return interaction.reply({ content: 'Only this profile’s owner or an administrator can manage this skill card.', ephemeral: true });
      const entryId = cardSelections.get(interaction.message.id);
      if (!entryId) return interaction.reply({ content: 'Select a skill from the list first.', ephemeral: true });
      const isSave = action === 'save1' || action === 'save2';
      if (isSave) {
        const savedCount = await getBatchSavedCount(interaction.guildId, memberId, batchId);
        if (savedCount >= MAX_SAVES_PER_ROLL) {
          return interaction.reply({ content: `This roll already has its maximum of ${MAX_SAVES_PER_ROLL} saved skills. Burn or freeze the remaining skill cards instead.`, ephemeral: true });
        }
      }
      const entry = await resolvePendingTalent(interaction.guildId, memberId, entryId, action);
      if (isSave) {
        await addAssignments(interaction.guildId, memberId, [entry.talent]);
        await recordBatchSave(interaction.guildId, memberId, batchId);
      }
      cardSelections.delete(interaction.message.id);
      const [profile, collection, allPendingTalents, customEmojis, savedCount] = await Promise.all([
        getProfile(interaction.guildId, memberId),
        getAssignment(interaction.guildId, memberId),
        getPendingTalents(interaction.guildId, memberId),
        getRarityEmojis(interaction.guildId),
        getBatchSavedCount(interaction.guildId, memberId, batchId),
      ]);
      const pendingTalents = allPendingTalents.filter((pending) => pending.batchId === batchId);
      const actionLabel = isSave ? 'Saved' : action === 'burn' ? 'Burned' : 'Frozen';
      return interaction.update({
        content: `${actionLabel} **${entry.talent.name}**.${action === 'freeze' ? ' It will remain on the next skill card.' : ''}`,
        embeds: [talentCardEmbed({ id: memberId }, profile, collection, pendingTalents, customEmojis)],
        components: talentCardControls(memberId, batchId, pendingTalents, savedCount),
      });
    }

    if (!interaction.isChatInputCommand()) return;
    if (interaction.commandName === 'skill') {
      const action = interaction.options.getSubcommand();
      if (action === 'roll') {
        if (!canRollTalents(interaction)) {
          return interaction.reply({ content: 'Only the server owner and administrators can roll skills for members.', ephemeral: true });
        }
        const amount = interaction.options.getInteger('amount') ?? 1;
        const requestedRarity = interaction.options.getString('rarity');
        const member = interaction.options.getUser('member') ?? interaction.user;
        const [existingTalents, pendingBefore, burnedTalents, profile] = await Promise.all([
          getAssignment(interaction.guildId, member.id),
          getPendingTalents(interaction.guildId, member.id),
          getBurnedTalents(interaction.guildId, member.id),
          getProfile(interaction.guildId, member.id),
        ]);
        const boostLevel = await consumeRarityBoost(interaction.guildId, member.id);
        const spinDetails = [];
        for (let index = 0; index < amount; index += 1) {
          const talentNumber = existingTalents.length + pendingBefore.length + index + 1;
          const milestone = talentNumber % 7 === 0;
          const appliedBoost = index === 0 ? boostLevel : 0;
          const talent = await weightedRoll({ milestone, boostLevel: appliedBoost, excludedNames: burnedTalents, rarity: requestedRarity, race: profile.race, tier: profile.tier });
          spinDetails.push({ talent, talentNumber, milestone, boostLevel: appliedBoost });
        }
        const rolledTalents = spinDetails.map((spin) => spin.talent);
        const newEntries = await addPendingTalents(interaction.guildId, member.id, rolledTalents);
        const batchId = newEntries[0].batchId;
        const collection = await getAssignment(interaction.guildId, member.id);
        const specialSpins = spinDetails
          .filter((spin) => spin.milestone || spin.boostLevel > 0)
          .map((spin) => `#${spin.talentNumber}: ${spin.milestone ? '✨ Fortune spin' : ''}${spin.milestone && spin.boostLevel ? ' + ' : ''}${spin.boostLevel ? `☘️ Rarity Boost Lv.${spin.boostLevel}` : ''}`);
        const specialText = specialSpins.length ? `\nSpecial spins — ${specialSpins.join(' • ')}` : '';
        const customEmojis = await getRarityEmojis(interaction.guildId);
        const rarityText = requestedRarity ? ` Tier filter: **${rarityStyle[requestedRarity].label}**.` : '';
        return interaction.reply({ embeds: [talentCardEmbed(member, profile, collection, newEntries, customEmojis)], components: talentCardControls(member.id, batchId, newEntries, 0), content: `${member.username} received **${amount}** pending skill${amount === 1 ? '' : 's'}. Select one, then save it in Slot 1 or Slot 2.${rarityText}${specialText}` });
      }
      if (action === 'mine' || action === 'view') {
        const member = action === 'mine' ? interaction.user : interaction.options.getUser('member', true);
        const talents = await getAssignment(interaction.guildId, member.id);
        if (talents.length === 0) return interaction.reply({ content: `${member.id === interaction.user.id ? 'You have' : `${member.username} has`} not rolled any skills yet.`, ephemeral: true });
        const customEmojis = await getRarityEmojis(interaction.guildId);
        return interaction.reply({ embeds: [talentListEmbed(talents, `${member.username}'s skills`, customEmojis)] });
      }
    }

    if (interaction.commandName === 'profile') {
      const member = interaction.options.getUser('member') ?? interaction.user;
      const [profile, talents, customEmojis] = await Promise.all([
        getProfile(interaction.guildId, member.id),
        getAssignment(interaction.guildId, member.id),
        getRarityEmojis(interaction.guildId),
      ]);
      return interaction.reply({ embeds: [profileEmbed(member, profile, talents, customEmojis)] });
    }

    if (interaction.commandName === 'profile-admin') {
      if (!isAdmin(interaction)) return interaction.reply({ content: 'Only server administrators can set up roleplay profiles.', ephemeral: true });
      const member = interaction.options.getUser('member', true);
      const requestedRace = interaction.options.getString('race');
      if (requestedRace !== null) {
        const races = await getRaces(interaction.guildId);
        if (!races.some((race) => sameRace(race, requestedRace))) {
          return interaction.reply({ content: `**${requestedRace}** is not a selectable race. Use \`/race-admin list\` or add it first.`, ephemeral: true });
        }
      }
      const updates = Object.fromEntries([
        ['level', interaction.options.getString('level')],
        ['class', interaction.options.getString('class')],
        ['tier', interaction.options.getInteger('tier')?.toString() ?? null],
        ['race', requestedRace],
      ].filter(([, value]) => value !== null));
      if (Object.keys(updates).length === 0) return interaction.reply({ content: 'Provide at least one value to update.', ephemeral: true });
      const profile = await setProfile(interaction.guildId, member.id, updates);
      return interaction.reply({ content: `Updated ${member.username}'s profile — Level: **${profile.level}**, Race: **${profile.race}**, Class: **${profile.class}**, Tier: **${profile.tier}**.`, ephemeral: true });
    }

    if (interaction.commandName === 'race-admin') {
      if (!isAdmin(interaction)) return interaction.reply({ content: 'Only server administrators can manage selectable races.', ephemeral: true });
      const action = interaction.options.getSubcommand();
      if (action === 'list') {
        const races = await getRaces(interaction.guildId);
        return interaction.reply({ content: `**Selectable races**\n${races.map((race) => `• ${race}`).join('\n')}`, ephemeral: true });
      }
      const name = interaction.options.getString('name', true);
      if (action === 'add') {
        await addRace(interaction.guildId, name);
        return interaction.reply({ content: `Added **${name.trim()}** as a selectable race.`, ephemeral: true });
      }
      const removed = await removeRace(interaction.guildId, name);
      return interaction.reply({ content: removed ? `Removed **${name}** from selectable races.` : `No selectable race named **${name}** exists.`, ephemeral: true });
    }

    if (interaction.commandName === 'skill-admin') {
      if (!isAdmin(interaction)) return interaction.reply({ content: 'Only server administrators can manage the skill system.', ephemeral: true });
      const action = interaction.options.getSubcommand();
      if (action === 'add') {
        const talent = await addTalent({ name: interaction.options.getString('name', true), rarity: interaction.options.getString('rarity', true), category: interaction.options.getString('category') ?? 'Innate', weight: interaction.options.getInteger('weight', true), description: interaction.options.getString('description', true), minTier: interaction.options.getInteger('min_tier') ?? undefined, races: parseRaceList(interaction.options.getString('races')) });
        return interaction.reply({ content: `Added **${talent.name}** to the skill pool with weight ${talent.weight}, minimum Tier ${talent.minTier ?? 'by rarity'}, and ${talent.races?.length ? talent.races.join(', ') : 'all races'} allowed.`, ephemeral: true });
      }
      if (action === 'remove') {
        const talent = await removeTalent(interaction.options.getString('name', true));
        return interaction.reply({ content: `Removed **${talent.name}** from the skill pool. Existing player rolls are unchanged.`, ephemeral: true });
      }
      if (action === 'edit') {
        const updates = {
          name: interaction.options.getString('new_name') ?? undefined,
          rarity: interaction.options.getString('rarity') ?? undefined,
          description: interaction.options.getString('description') ?? undefined,
          minTier: interaction.options.getInteger('min_tier') ?? undefined,
          races: interaction.options.getString('races') === null ? undefined : parseRaceList(interaction.options.getString('races')),
        };
        Object.keys(updates).forEach((key) => updates[key] === undefined && delete updates[key]);
        if (Object.keys(updates).length === 0) {
          return interaction.reply({ content: 'Choose at least one value to change: new name, rarity, description, minimum tier, or races.', ephemeral: true });
        }
        const talent = await updateTalent(interaction.options.getString('name', true), updates);
        return interaction.reply({ content: `Updated **${talent.name}** in the skill pool.`, ephemeral: true });
      }
      if (action === 'grant') {
        const member = interaction.options.getUser('member', true);
        const name = interaction.options.getString('name', true);
        const skills = await getTalents();
        const skill = skills.find((item) => item.name.toLowerCase() === name.toLowerCase());
        if (!skill) return interaction.reply({ content: `No pool skill named **${name}** exists. Use \`/skill-admin pool\` to check the exact name.`, ephemeral: true });
        await addAssignments(interaction.guildId, member.id, [skill]);
        return interaction.reply({ content: `Granted **${skill.name}** directly to ${member.username}'s profile.`, ephemeral: true });
      }
      if (action === 'revoke') {
        const member = interaction.options.getUser('member', true);
        const removed = await removeAssignment(interaction.guildId, member.id, interaction.options.getString('name', true));
        if (!removed) return interaction.reply({ content: `${member.username} does not have a saved skill with that exact name.`, ephemeral: true });
        return interaction.reply({ content: `Removed one copy of **${removed.name}** from ${member.username}'s saved skills.`, ephemeral: true });
      }
      if (action === 'boost') {
        const member = interaction.options.getUser('member', true);
        const level = interaction.options.getInteger('level', true);
        const appliedLevel = await grantRarityBoost(interaction.guildId, member.id, level);
        return interaction.reply({ content: `Granted ${member.username} a one-use **Rarity Boost Lv.${appliedLevel}**. It applies to their next skill rolled.`, ephemeral: true });
      }
      if (action === 'emoji') {
        const rarity = interaction.options.getString('rarity', true);
        const emoji = interaction.options.getString('emoji', true);
        await setRarityEmoji(interaction.guildId, rarity, emoji);
        return interaction.reply({ content: `Set ${rarity} skill embeds to use ${emoji}.`, ephemeral: true });
      }
      if (action === 'pool') {
        const rarity = interaction.options.getString('rarity');
        const [allTalents, customEmojis] = await Promise.all([getTalents(), getRarityEmojis(interaction.guildId)]);
        const talents = rarity ? allTalents.filter((talent) => talent.rarity === rarity) : allTalents;
        return interaction.reply({ embeds: [talentPoolEmbed(talents, customEmojis, 0, rarity)], components: talentPoolControls(0, talents.length, rarity), ephemeral: true });
      }
      const member = interaction.options.getUser('member', true);
      const cleared = await clearAssignment(interaction.guildId, member.id);
      return interaction.reply({ content: cleared ? `Cleared every skill earned by ${member.username}.` : `${member.username} did not have any saved skills.`, ephemeral: true });
    }
  } catch (error) {
    console.error(error);
    const reply = { content: `Something went wrong: ${error.message}`, ephemeral: true };
    if (interaction.replied || interaction.deferred) await interaction.followUp(reply);
    else await interaction.reply(reply);
  }
});

client.login(token);
