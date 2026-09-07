import { PermissionFlagsBits, SlashCommandBuilder } from 'discord.js';

const rarityChoices = [
  { name: 'Common Skill', value: 'common' },
  { name: 'Extra Skill', value: 'uncommon' },
  { name: 'Intrinsic Skill', value: 'rare' },
  { name: 'Unique Skill', value: 'epic' },
  { name: 'Ultimate Skill', value: 'legendary' },
];

export const commands = [
  new SlashCommandBuilder()
    .setName('skill')
    .setDescription('Roll or view a character skill.')
    .addSubcommand((subcommand) => subcommand
      .setName('roll')
      .setDescription('Roll one or more skills.')
      .addIntegerOption((option) => option
        .setName('amount')
        .setDescription('How many skills to roll (default: 1).')
        .setMinValue(1)
        .setMaxValue(5))
      .addStringOption((option) => option
        .setName('rarity')
        .setDescription('Limit this roll to one skill tier.')
        .addChoices(...rarityChoices))
      .addUserOption((option) => option
        .setName('member')
        .setDescription('Member receiving the skills (default: you).')))
    .addSubcommand((subcommand) => subcommand.setName('mine').setDescription('View your earned skills.'))
    .addSubcommand((subcommand) => subcommand
      .setName('view')
      .setDescription('View a member’s earned skills.')
      .addUserOption((option) => option.setName('member').setDescription('Member to inspect.').setRequired(true))),
  new SlashCommandBuilder()
    .setName('skill-admin')
    .setDescription('Manage this server’s skill system.')
    .setDefaultMemberPermissions(PermissionFlagsBits.Administrator)
    .addSubcommand((subcommand) => subcommand
      .setName('add')
      .setDescription('Add a skill to the RNG pool.')
      .addStringOption((option) => option.setName('name').setDescription('Skill name.').setRequired(true).setMaxLength(80))
      .addStringOption((option) => option.setName('rarity').setDescription('Skill rarity.').setRequired(true)
        .addChoices(...rarityChoices))
      .addIntegerOption((option) => option.setName('weight').setDescription('Relative roll chance; higher is more common.').setRequired(true).setMinValue(1).setMaxValue(100000))
      .addStringOption((option) => option.setName('description').setDescription('What the skill does.').setRequired(true).setMaxLength(1000))
      .addStringOption((option) => option.setName('category').setDescription('Skill category (default: Innate).').setMaxLength(40)))
    .addSubcommand((subcommand) => subcommand
      .setName('remove')
      .setDescription('Remove a skill from the RNG pool.')
      .addStringOption((option) => option.setName('name').setDescription('Exact skill name.').setRequired(true)))
    .addSubcommand((subcommand) => subcommand
      .setName('edit')
      .setDescription('Edit a skill already in the RNG pool.')
      .addStringOption((option) => option.setName('name').setDescription('Current exact skill name.').setRequired(true))
      .addStringOption((option) => option.setName('new_name').setDescription('New skill name.').setMaxLength(80))
      .addStringOption((option) => option.setName('rarity').setDescription('New rarity.')
        .addChoices(...rarityChoices))
      .addStringOption((option) => option.setName('description').setDescription('New skill description.').setMaxLength(1000)))
    .addSubcommand((subcommand) => subcommand
      .setName('grant')
      .setDescription('Give a specific pool skill directly to a member.')
      .addUserOption((option) => option.setName('member').setDescription('Member receiving the skill.').setRequired(true))
      .addStringOption((option) => option.setName('name').setDescription('Exact name of a skill in the pool.').setRequired(true)))
    .addSubcommand((subcommand) => subcommand
      .setName('clear')
      .setDescription('Clear all skills earned by a member.')
      .addUserOption((option) => option.setName('member').setDescription('Member whose skills to clear.').setRequired(true)))
    .addSubcommand((subcommand) => subcommand
      .setName('boost')
      .setDescription('Give a member a one-use rarity boost for their next skill.')
      .addUserOption((option) => option.setName('member').setDescription('Member receiving the boost.').setRequired(true))
      .addIntegerOption((option) => option
        .setName('level')
        .setDescription('Boost level: 1 is small; 5 is very strong.')
        .setRequired(true)
        .setMinValue(1)
        .setMaxValue(5)))
    .addSubcommand((subcommand) => subcommand
      .setName('emoji')
      .setDescription('Set the custom emoji displayed for a skill rarity in embeds.')
      .addStringOption((option) => option.setName('rarity').setDescription('Rarity to style.').setRequired(true)
        .addChoices(...rarityChoices))
      .addStringOption((option) => option.setName('emoji').setDescription('Paste a server emoji, such as <:rare:123>.').setRequired(true).setMaxLength(100)))
    .addSubcommand((subcommand) => subcommand
      .setName('pool')
      .setDescription('View the hidden pool, grouped by category and optionally filtered by rarity.')
      .addStringOption((option) => option
        .setName('rarity')
        .setDescription('Only show skills of this rarity.')
        .addChoices(...rarityChoices)))
  ,
  new SlashCommandBuilder()
    .setName('profile')
    .setDescription('View a roleplay profile.')
    .addSubcommand((subcommand) => subcommand
      .setName('view')
      .setDescription('View your profile or a member’s profile.')
      .addUserOption((option) => option.setName('member').setDescription('Member to inspect.'))),
  new SlashCommandBuilder()
    .setName('profile-admin')
    .setDescription('Set up roleplay profiles.')
    .setDefaultMemberPermissions(PermissionFlagsBits.Administrator)
    .addSubcommand((subcommand) => subcommand
      .setName('set')
      .setDescription('Set a member’s current level, class, or tier.')
      .addUserOption((option) => option.setName('member').setDescription('Member whose profile to update.').setRequired(true))
      .addStringOption((option) => option.setName('level').setDescription('Level shown on the skill card.'))
      .addStringOption((option) => option.setName('class').setDescription('Class shown on the profile.'))
      .addStringOption((option) => option.setName('tier').setDescription('Tier shown on the skill card.'))
      .addStringOption((option) => option.setName('race').setDescription('Race shown on the profile.')))
].map((command) => command.toJSON());
