require('dotenv').config();
const { REST, Routes, SlashCommandBuilder } = require('discord.js');

const commands = [
    new SlashCommandBuilder().setName('ping').setDescription('🏓 Comprueba la latencia.'),
    new SlashCommandBuilder().setName('hola').setDescription('👋 Saluda al bot.'),
    new SlashCommandBuilder().setName('mute').setDescription('🔇 Mutea a un usuario por un tiempo')
        .addUserOption(option => option.setName('usuario').setDescription('Usuario a mutear').setRequired(true))
        .addStringOption(option => option.setName('tiempo').setDescription('Tiempo en minutos').setRequired(true)),
    new SlashCommandBuilder().setName('unmute').setDescription('🔊 Desmutea a un usuario')
        .addUserOption(option => option.setName('usuario').setDescription('Usuario a desmutear').setRequired(true)),
    new SlashCommandBuilder().setName('ban').setDescription('🚫 Banea a un usuario por un tiempo')
        .addUserOption(option => option.setName('usuario').setDescription('Usuario a banear').setRequired(true))
        .addStringOption(option => option.setName('tiempo').setDescription('Tiempo en días').setRequired(true)),
    new SlashCommandBuilder().setName('unban').setDescription('🔓 Desbanea a un usuario')
        .addStringOption(option => option.setName('usuario').setDescription('ID del usuario a desbanear').setRequired(true)),
        new SlashCommandBuilder().setName('servers').setDescription('🖥️ Muestra los servidores en los que está el bot'),
        new SlashCommandBuilder().setName('coinflip').setDescription('🎲 Lanza una moneda (Cara o Cruz).'),
        new SlashCommandBuilder().setName('botinfo').setDescription('🤖 Muestra información sobre el bot.'),
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
        ),
    new SlashCommandBuilder()
        .setName('scanlink')
        .setDescription('🔍 Analiza un enlace con VirusTotal.')
        .addStringOption(option =>
            option.setName('url')
                .setDescription('El enlace que deseas analizar.')
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
