require('dotenv').config();
const { REST, Routes, SlashCommandBuilder } = require('discord.js');

const commands = [
    new SlashCommandBuilder().setName('ping').setDescription('🏓 Comprueba la latencia.'),
    new SlashCommandBuilder().setName('hola').setDescription('👋 Saluda al bot.'),
    new SlashCommandBuilder().setName('anti_links_enable').setDescription('🚫 Activa el anti-links de invitaciones.'),
    new SlashCommandBuilder().setName('anti_links_disable').setDescription('✅ Desactiva el anti-links de invitaciones.'),
    new SlashCommandBuilder().setName('serverinfo').setDescription('📌 Muestra información del servidor.'),
    new SlashCommandBuilder().setName('userinfo').setDescription('👤 Muestra información detallada del usuario.'),
    new SlashCommandBuilder().setName('help').setDescription('📜 Muestra la lista de comandos disponibles.'),
    new SlashCommandBuilder()
        .setName('setlogs')
        .setDescription('📂 Configura un canal para registrar eventos del servidor.')
        .addChannelOption(option =>
            option.setName('canal')
                .setDescription('Selecciona el canal donde se enviarán los logs.')
                .setRequired(true)
        )
].map(command => command.toJSON());

const rest = new REST({ version: '10' }).setToken(process.env.TOKEN);

(async () => {
    try {
        console.log('📢 Registrando comandos...');
        await rest.put(
            Routes.applicationCommands(process.env.CLIENT_ID),
            { body: commands }
        );
        console.log('✅ Comandos registrados exitosamente.');
    } catch (error) {
        console.error('❌ Error al registrar comandos:', error);
    }
})();
