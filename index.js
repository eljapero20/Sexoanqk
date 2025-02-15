require('dotenv').config(); // Cargar variables de entorno
const fs = require('fs');
const { Client, GatewayIntentBits, PermissionsBitField, Events, EmbedBuilder } = require("discord.js");

// Cargar configuración desde config.json o establecer valores por defecto
const configPath = './config.json';
let config = { servers: {} };
if (fs.existsSync(configPath)) {
    config = JSON.parse(fs.readFileSync(configPath, 'utf8'));
}

// Crear cliente de Discord
const client = new Client({
    intents: [
        GatewayIntentBits.Guilds,
        GatewayIntentBits.GuildMessages,
        GatewayIntentBits.MessageContent,
        GatewayIntentBits.GuildMembers,
        GatewayIntentBits.GuildModeration
    ]
});

// Guardar configuración en config.json
function saveConfig() {
    fs.writeFileSync(configPath, JSON.stringify(config, null, 4));
}

// Evento cuando el bot está listo
client.once(Events.ClientReady, () => {
    console.log(`Bot conectado como ${client.user.tag}`);
});

// Asegurar que el servidor tenga una configuración predeterminada en config.json
function ensureServerConfig(guildId) {
    if (!config.servers[guildId]) {
        config.servers[guildId] = {
            antiLinks: false,
            logChannel: null
        };
        saveConfig();
    }
}

// Evento cuando el bot se une a un nuevo servidor
client.on(Events.GuildCreate, guild => {
    ensureServerConfig(guild.id);  // Aquí se asegura que el servidor tenga una configuración
    console.log(`✅ Nuevo servidor añadido: ${guild.name} (${guild.id})`);
});

// Evento para manejar interacciones (comandos slash)
client.on(Events.InteractionCreate, async interaction => {
    if (!interaction.isChatInputCommand()) return;

    const { commandName, member, guild, options } = interaction;

    // Asegurarse de que haya configuración para el servidor antes de acceder a ella
    ensureServerConfig(guild.id);

    if (commandName === 'ping') {
        await interaction.reply('🏓 Pong!');
    } else if (commandName === 'hola') {
        await interaction.reply('👋 ¡Hola!');
    } else if (commandName === 'anti_links_enable') {
    ensureServerConfig(guild.id);  // Asegura que haya configuración

    if (config.servers[guild.id].antiLinks) {
        await interaction.reply('⚠️ **El anti-links ya está activado en este servidor.**');
    } else {
        config.servers[guild.id].antiLinks = true;
        saveConfig();
        await interaction.reply('✅ **Anti-links de este servidor ha sido activado**.');
    }

} else if (commandName === 'anti_links_disable') {
    ensureServerConfig(guild.id);  // Asegura que haya configuración

    if (!config.servers[guild.id].antiLinks) {
        await interaction.reply('⚠️ **El anti-links ya está desactivado en este servidor.**');
    } else {
        config.servers[guild.id].antiLinks = false;
        saveConfig();
        await interaction.reply('✅ **Anti-links de este servidor ha sido desactivado**.');
    }

    } else if (commandName === 'serverinfo') {
        const embed = new EmbedBuilder()
            .setColor(0x6a0dad)
            .setTitle(interaction.guild.name)
            .setDescription(`📅 Creado el: ${interaction.guild.createdAt.toDateString()}`)
            .addFields(
                { name: '👥 Miembros', value: `${interaction.guild.memberCount}`, inline: true },
                { name: '📢 Canales', value: `${interaction.guild.channels.cache.size}`, inline: true },
                { name: '🛡 Roles', value: `${interaction.guild.roles.cache.size}`, inline: true }
            )
            .setThumbnail(interaction.guild.iconURL());
        await interaction.reply({ embeds: [embed] });
    } else if (commandName === 'setlogs') {
        if (!member.permissions.has(PermissionsBitField.Flags.Administrator)) {
            return interaction.reply({ content: '❌ No tienes permisos para configurar los logs.', ephemeral: true });
        }
    
        const channel = options.getChannel('canal');
    
        // Verificar que la configuración del servidor existe
        if (!config.servers[guild.id]) {
            config.servers[guild.id] = { logChannel: null };
            saveConfig();
        }
    
        config.servers[guild.id].logChannel = channel.id;
        saveConfig();
    
        await interaction.reply(`✅ Canal de logs configurado en <#${channel.id}>.`);
    
    } else if (commandName === 'userinfo') {
        const user = interaction.options.getUser('usuario') || interaction.user;
        const member = await interaction.guild.members.fetch(user.id);
        const roles = member.roles.cache.filter(role => role.id !== interaction.guild.id).map(role => role.toString()).join(', ') || 'Ninguno';

        const embed = new EmbedBuilder()
            .setColor(member.displayHexColor !== '#000000' ? member.displayHexColor : '#0099ff')
            .setTitle(`Información de ${user.tag}`)
            .setThumbnail(user.displayAvatarURL({ dynamic: true }))
            .addFields(
                { name: '🆔 ID', value: user.id, inline: true },
                { name: '📅 Cuenta creada el', value: `<t:${Math.floor(user.createdTimestamp / 1000)}:D>`, inline: true },
                { name: '📅 Se unió el', value: `<t:${Math.floor(member.joinedTimestamp / 1000)}:D>`, inline: true },
                { name: '🎭 Roles', value: roles, inline: false },
                { name: '🎨 Color', value: member.displayHexColor, inline: true }
            )
            .setFooter({ text: `Solicitado por ${interaction.user.tag}`, iconURL: interaction.user.displayAvatarURL() })
            .setTimestamp();

        await interaction.reply({ embeds: [embed] });
    } else if (commandName === 'help') {
        try {
            const embed = new EmbedBuilder()
                .setColor(0x0099ff)
                .setTitle('📜 Lista de Comandos')
                .setDescription('Aquí están todos los comandos disponibles en el bot:')
                .addFields(
                    { name: '/ping', value: '🏓 Comprueba la latencia del bot.' },
                    { name: '/hola', value: '👋 Saluda al bot.' },
                    { name: '/anti_links_enable', value: '🚫 Activa el anti-links para bloquear invitaciones de Discord.' },
                    { name: '/anti_links_disable', value: '✅ Desactiva el anti-links.' },
                    { name: '/serverinfo', value: '📌 Muestra información del servidor.' },
                    { name: '/userinfo', value: '👤 Muestra información detallada del usuario.' },
                    { name: '/setlogs', value: '📂 Configura un canal para registrar logs de eventos.' },
                    { name: '/help', value: '📜 Muestra esta lista de comandos.' }
                )
                .setFooter({ text: 'Usa los comandos en cualquier canal disponible.' });

            await interaction.reply({ embeds: [embed] });
        } catch (error) {
            console.error('❌ Error al ejecutar /help:', error);
            await interaction.reply({ content: '❌ Hubo un error al mostrar la lista de comandos.', ephemeral: true });
        }
    }
});


// Evento para eliminar links y sancionar por 15 minutos si anti-links está activado
client.on(Events.MessageCreate, async (message) => {
    // Verifica que la configuración exista para este servidor
    if (!config.servers[message.guild.id] || !config.servers[message.guild.id].antiLinks) return;

    if (message.author.bot) return;
    if (message.member.permissions.has(PermissionsBitField.Flags.Administrator)) return; // No borrar mensajes de admins

    const inviteRegex = /(discord\.gg\/|discord\.com\/invite\/)/gi;
    if (inviteRegex.test(message.content)) {
        try {
            await message.delete();
            await message.channel.send(`🚫 ${message.author}, los links de invitación están prohibidos. Has sido sancionado por 15 minutos.`);
            await message.member.timeout(15 * 60 * 1000, 'Envío de invitación no autorizada.');
        } catch (error) {
            console.error('❌ No se pudo eliminar el mensaje o sancionar al usuario:', error);
            await message.channel.send('⚠️ No se pudo sancionar al usuario. Asegúrate de que el bot tenga permisos suficientes.');
        }
    }
});


// Evento para registrar logs en el canal configurado
client.on(Events.MessageDelete, async message => {
    const logChannelId = config.servers[message.guild.id]?.logChannel;
    if (!logChannelId) return;

    const logChannel = message.guild.channels.cache.get(logChannelId);
    if (!logChannel) return;

    const embed = new EmbedBuilder()
        .setColor('#FF0000')
        .setTitle('🗑 Mensaje Eliminado')
        .setDescription(`**Autor:** ${message.author.tag}\n**Canal:** ${message.channel}\n**Mensaje:** ${message.content || 'Contenido no disponible'}`)
        .setTimestamp();
    logChannel.send({ embeds: [embed] });
});

client.on(Events.GuildBanAdd, async (ban) => {
    if (!config.servers[ban.guild.id]) config.servers[ban.guild.id] = { logChannel: null };

    const logChannelId = config.servers[ban.guild.id].logChannel;
    if (!logChannelId) return;
    
    const logChannel = ban.guild.channels.cache.get(logChannelId);
    if (!logChannel) return;
    
    const embed = new EmbedBuilder()
        .setColor('#FF0000')
        .setTitle('🚨 Usuario Baneado')
        .setDescription(`**Usuario:** ${ban.user.tag}\n🆔 ID: ${ban.user.id}`)
        .setTimestamp();

    logChannel.send({ embeds: [embed] });
});


// Conectar cliente a Discord
client.login(process.env.TOKEN);
