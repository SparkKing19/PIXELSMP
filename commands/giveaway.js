const { SlashCommandBuilder, EmbedBuilder, PermissionFlagsBits } = require('discord.js');
const Giveaway = require('../models/giveaway');

// Helper: Parse 12-Hour Indian Standard Time (IST - e.g., "06:30 PM", "11:00 AM", "6:05pm")
function parseIST12HourTime(timeStr) {
    const match = timeStr.trim().match(/^(\d{1,2}):(\d{2})\s*(AM|PM)$/i);
    if (!match) return null;

    let hour = parseInt(match[1], 10);
    const min = parseInt(match[2], 10);
    const period = match[3].toUpperCase();

    if (hour < 1 || hour > 12 || min < 0 || min > 59) return null;

    // Convert 12-hour to 24-hour equivalent
    if (period === 'PM' && hour !== 12) hour += 12;
    if (period === 'AM' && hour === 12) hour = 0;

    const nowUtc = Date.now();
    const istOffset = 5.5 * 60 * 60 * 1000;
    const nowIstDate = new Date(nowUtc + istOffset);

    const istYear = nowIstDate.getUTCFullYear();
    const istMonth = nowIstDate.getUTCMonth();
    const istDay = nowIstDate.getUTCDate();

    let targetUtcEpoch = Date.UTC(istYear, istMonth, istDay, hour, min, 0) - istOffset;

    // Schedule for the next calendar day if the target time has already passed today
    if (targetUtcEpoch <= nowUtc) {
        targetUtcEpoch += 24 * 60 * 60 * 1000;
    }

    return new Date(targetUtcEpoch);
}

module.exports = {
    data: new SlashCommandBuilder()
        .setName('giveaway')
        .setDescription('Host a real-time giveaway with 12-hour IST scheduling')
        .addChannelOption(option =>
            option.setName('channel')
                .setDescription('The destination channel where the giveaway will be hosted')
                .setRequired(true)
        )
        .addStringOption(option =>
            option.setName('reward')
                .setDescription('The prize or reward for the winner(s)')
                .setRequired(true)
        )
        .addIntegerOption(option =>
            option.setName('winners')
                .setDescription('Total number of winners to select')
                .setRequired(true)
        )
        .addStringOption(option =>
            option.setName('time')
                .setDescription('Exact end time in 12-hour IST format (e.g. 06:30 PM, 11:00 AM)')
                .setRequired(true)
        ),
    async execute(interaction) {
        if (!interaction.member.permissions.has(PermissionFlagsBits.ManageGuild)) {
            return interaction.reply({ 
                content: '❌ You lack the required **Manage Server** permissions to host giveaways.', 
                ephemeral: true 
            });
        }

        const channel = interaction.options.getChannel('channel');
        const reward = interaction.options.getString('reward');
        const winnerCount = interaction.options.getInteger('winners');
        const rawTime = interaction.options.getString('time');

        const endDate = parseIST12HourTime(rawTime);
        if (!endDate) {
            return interaction.reply({ 
                content: '❌ Invalid time format! Please provide a valid 12-hour time format with AM/PM (e.g., `06:30 PM`, `11:15 AM`).', 
                ephemeral: true 
            });
        }

        const endTimestamp = Math.floor(endDate.getTime() / 1000);

        const giveawayEmbed = new EmbedBuilder()
            .setColor('#5865F2')
            .setDescription(
`<a:GIFT_BOX:1540768962319491153> **GIVEAWAY STARTED** <a:GIFT_BOX:1540768962319491153>

⟢ **Hosted By**    : <@${interaction.user.id}>
⟢ **Prize**        : **${reward}**
⟢ **Winner(s)**    : **${winnerCount}**
⟢ **Ends At**      : <t:${endTimestamp}:F> (<t:${endTimestamp}:R>)

──────────────────────────

➥ Click <a:PARTY_POPPER:1540768772749791384> below to enter the giveaway!`
            )
            .setFooter({ text: 'Enterprise Giveaway System • IST Scheduled' })
            .setTimestamp();

        const giveawayMsg = await channel.send({ embeds: [giveawayEmbed] });
        
        await giveawayMsg.react('<a:PARTY_POPPER:1540768772749791384>').catch(async () => {
            await giveawayMsg.react('🎉');
        });

        await Giveaway.create({
            guildId: interaction.guild.id,
            channelId: channel.id,
            messageId: giveawayMsg.id,
            hostId: interaction.user.id,
            reward,
            winnerCount,
            endsAt: endDate,
            ended: false
        });

        await interaction.reply({ 
            content: `✅ Giveaway successfully launched in <#${channel.id}>! It will automatically conclude at **${rawTime.toUpperCase()} (IST)**.`, 
            ephemeral: true 
        });
    }
};
