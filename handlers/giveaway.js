const { EmbedBuilder } = require('discord.js');
const Giveaway = require('../models/giveaway');

async function endGiveaway(client, g) {
    await Giveaway.updateOne({ _id: g._id }, { ended: true });

    const guild = client.guilds.cache.get(g.guildId);
    if (!guild) return;

    const channel = guild.channels.cache.get(g.channelId);
    if (!channel) return;

    const message = await channel.messages.fetch(g.messageId).catch(() => null);
    if (!message) return;

    // Fetch entries from reactions
    const reaction = message.reactions.cache.get('1540171562156822660') || message.reactions.cache.get('🎉');
    let validUsers = [];

    if (reaction) {
        const users = await reaction.users.fetch();
        validUsers = users.filter(u => !u.bot).map(u => u.id);
    }

    // Pick Winners
    const winners = [];
    if (validUsers.length > 0) {
        const shuffled = validUsers.sort(() => 0.5 - Math.random());
        const picked = shuffled.slice(0, g.winnerCount);
        winners.push(...picked);
    }

    const winnersText = winners.length > 0 
        ? winners.map(w => `▸ <@${w}>`).join('\n') 
        : '*No valid entries recorded.*';

    const endedEmbed = new EmbedBuilder()
        .setColor('#ED4245')
        .setDescription(
`<a:GIFT_BOX:1540768962319491153> **GIVEAWAY ENDED** <a:GIFT_BOX:1540768962319491153>

⟢ **Prize**          : **${g.reward}**
⟢ **Total Winner(s)**: **${g.winnerCount}**
⟢ **Host**           : <@${g.hostId}>

──────────────────────────

<a:TROPHY:1540769081962012692> **WINNER LIST**
${winnersText}

──────────────────────────

<a:POPPER:1540769035757686945> Congratulations to all victorious participants!`
        )
        .setFooter({ text: 'Enterprise Giveaway System • Event Concluded' })
        .setTimestamp();

    await message.edit({ embeds: [endedEmbed] }).catch(console.error);

    if (winners.length > 0) {
        await channel.send({ 
            content: `<a:POPPER:1540769035757686945> Congratulations ${winners.map(w => `<@${w}>`).join(', ')}! You won **${g.reward}**!` 
        });
    } else {
        await channel.send({ content: `⚠️ The giveaway for **${g.reward}** has ended, but no eligible participants were found.` });
    }
}

module.exports = (client) => {
    setInterval(async () => {
        try {
            const now = new Date();
            const dueGiveaways = await Giveaway.find({ ended: false, endsAt: { $lte: now } });

            for (const g of dueGiveaways) {
                await endGiveaway(client, g);
            }
        } catch (err) {
            console.error('Giveaway interval execution error:', err);
        }
    }, 1000);

    console.log('✔ Professional Giveaway Handler loaded.');
};
