const { Client, GatewayIntentBits, Partials, SlashCommandBuilder, REST, Routes, EmbedBuilder } = require('discord.js');
const fs = require('fs');
const path = require('path');
const { TOKEN, CLIENT_ID, GUILD_ID, authorizedUsers } = require('./config');

// Initialiser le client Discord
const client = new Client({
    intents: [GatewayIntentBits.Guilds, GatewayIntentBits.GuildMessages, GatewayIntentBits.DirectMessages],
    partials: [Partials.Channel]
});

// Charger les items depuis le fichier JSON
const itemsPath = path.join(__dirname, 'items.json');
let items = [];

try {
    const data = fs.readFileSync(itemsPath, 'utf8');
    items = JSON.parse(data);
} catch (error) {
    console.error('Erreur lors de la lecture du fichier items.json:', error);
}

// Enregistrer les commandes /gen et /rs
const rest = new REST({ version: '10' }).setToken(TOKEN);

(async () => {
    const commands = [
        new SlashCommandBuilder()
            .setName('gen')
            .setDescription('Génère un objet aléatoire et l\'envoie en MP'),
        new SlashCommandBuilder()
            .setName('rs')
            .setDescription('Ajoute un objet et une quantité')
            .addStringOption(option => 
                option.setName('objet')
                      .setDescription('L\'objet à ajouter')
                      .setRequired(true))
            .addIntegerOption(option => 
                option.setName('quantité')
                      .setDescription('La quantité à ajouter')
                      .setRequired(true))
    ].map(command => command.toJSON());

    try {
        console.log('Started refreshing application (/) commands.');

        await rest.put(
            Routes.applicationGuildCommands(CLIENT_ID, GUILD_ID),
            { body: commands },
        );

        console.log('Successfully reloaded application (/) commands.');
    } catch (error) {
        console.error(error);
    }
})();

// Gestion des cooldowns
const cooldowns = new Map();

// Gérer l'événement d'interaction
client.on('interactionCreate', async interaction => {
    if (!interaction.isCommand()) return;

    const { commandName, user } = interaction;

    if (commandName === 'gen') {
        if (items.length === 0) {
            return interaction.reply('Aucun objet disponible.');
        }

        const now = Date.now();
        const cooldownAmount = 24 * 60 * 60 * 1000; // 24 heures en millisecondes

        if (cooldowns.has(user.id)) {
            const expirationTime = cooldowns.get(user.id) + cooldownAmount;

            if (now < expirationTime) {
                const timeLeft = (expirationTime - now) / (1000 * 60 * 60);
                return interaction.reply({ content: `Vous devez attendre ${timeLeft.toFixed(1)} heures avant de pouvoir réutiliser cette commande.`, ephemeral: true });
            }
        }

        cooldowns.set(user.id, now);

        const randomItem = items[Math.floor(Math.random() * items.length)];

        try {
            await interaction.user.send(`Voici votre objet : ${randomItem}`);
            await interaction.reply({ content: 'Objet envoyé en MP!', ephemeral: true });
        } catch (error) {
            console.error('Erreur lors de l\'envoi du message privé:', error);
            await interaction.reply({ content: 'Impossible d\'envoyer un message privé. Veuillez vérifier vos paramètres de confidentialité.', ephemeral: true });
        }
    }

    if (commandName === 'rs') {
        if (!authorizedUsers.includes(user.id)) {
            return interaction.reply({ content: 'Vous n\'êtes pas autorisé à utiliser cette commande.', ephemeral: true });
        }

        const objet = interaction.options.getString('objet');
        const quantité = interaction.options.getInteger('quantité');

        const embed = new EmbedBuilder()
            .setTitle('Stocks mis a jour !')
            .addFields(
                { name: 'Objet', value: objet, inline: true },
                { name: 'Quantité', value: quantité.toString(), inline: true }
            )
            .setColor('#00FF00')
            .setTimestamp();

        await interaction.reply({ embeds: [embed] });
    }
});

// Se connecter au bot
client.login(TOKEN);
