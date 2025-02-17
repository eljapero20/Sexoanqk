require('dotenv').config(); 
const axios = require('axios'); // Importar Axios para subir archivos a Imgur

const IMGUR_CLIENT_ID = process.env.IMGUR_CLIENT_ID; // Cargar Client ID de Imgur
const VIRUSTOTAL_API_KEY = process.env.VIRUSTOTAL_API_KEY; // Cargar API Key de VirusTotal

// Cargar el token del bot
const token = process.env.TOKEN;

// Verificar que el token se haya cargado correctamente
if (!token) {
    console.error('No se pudo cargar el token del bot. Asegúrate de que el archivo .env esté correctamente configurado.');
    process.exit(1);  // Terminar el proceso si no hay token
}

const fs = require('fs');
const { Client, GatewayIntentBits, PermissionsBitField, Events, EmbedBuilder } = require("discord.js");
const mutesPath = './mutes.json';
const bansPath = './bans.json';

// Cargar mutes y bans desde los archivos si existen
let mutes = fs.existsSync(mutesPath) ? JSON.parse(fs.readFileSync(mutesPath, 'utf8')) : {};
let bans = fs.existsSync(bansPath) ? JSON.parse(fs.readFileSync(bansPath, 'utf8')) : {};

// Función para guardar mutes en mutes.json
function saveMutes() {
    fs.writeFileSync(mutesPath, JSON.stringify(mutes, null, 4));
}

// Función para guardar bans en bans.json
function saveBans() {
    fs.writeFileSync(bansPath, JSON.stringify(bans, null, 4));
}

// Función para agregar un mute
async function muteUser(userId, time) {
    const until = new Date(Date.now() + time * 60000); // Calcula el tiempo de expiración
    mutes[userId] = { until: until.toISOString() };

    saveMutes();  // Guarda el mute
    return `Usuario muteado hasta ${until.toISOString()}`;
}

// Función para eliminar un mute
async function unmuteUser(userId) {
    delete mutes[userId];

    saveMutes();  // Guarda los cambios
    return `Usuario desmuteado.`;
}

// Función para agregar un ban
async function banUser(userId, time) {
    const until = new Date(Date.now() + time * 86400000); // Calcula el tiempo de expiración (en días)
    bans[userId] = { until: until.toISOString() };

    saveBans();  // Guarda el ban
    return `Usuario baneado hasta ${until.toISOString()}`;
}

// Función para eliminar un ban
async function unbanUser(userId) {
    delete bans[userId];

    saveBans();  // Guarda los cambios
    return `Usuario desbaneado.`;
}

// Cargar configuración desde config.json o establecer valores por defecto
const configPath = './config.json';
let config = { servers: {} };
if (fs.existsSync(configPath)) {
    config = JSON.parse(fs.readFileSync(configPath, 'utf8'));
}

async function uploadToImgur(imageUrl) {
    try {
        const response = await axios.post('https://api.imgur.com/3/image', {
            image: imageUrl,
            type: 'URL'
        }, {
            headers: { Authorization: `Client-ID ${IMGUR_CLIENT_ID}` }
        });

        return response.data.data.link; // Devuelve el enlace de la imagen subida
    } catch (error) {
        console.error('❌ Error al subir a Imgur:', error);
        return null;
    }
}

async function scanUrlWithVirusTotal(url) {
    try {
        // Convertir la URL en formato x-www-form-urlencoded
        const params = new URLSearchParams();
        params.append('url', url);

        // Enviar la URL a VirusTotal para su análisis
        const response = await axios.post(
            'https://www.virustotal.com/api/v3/urls',
            params, // Enviar en formato correcto
            { headers: { 'x-apikey': VIRUSTOTAL_API_KEY, 'Content-Type': 'application/x-www-form-urlencoded' } }
        );

        const analysisId = response.data.data.id;

        // Esperar unos segundos antes de obtener el resultado
        await new Promise(resolve => setTimeout(resolve, 5000));

        // Obtener el resultado del análisis
        const result = await axios.get(`https://www.virustotal.com/api/v3/analyses/${analysisId}`, {
            headers: { 'x-apikey': VIRUSTOTAL_API_KEY }
        });

        const stats = result.data.data.attributes.stats;
        const malicious = stats.malicious || 0;
        const suspicious = stats.suspicious || 0;

        if (malicious > 0 || suspicious > 0) {
            return `⚠️ **El enlace es sospechoso o malicioso.**\n🔍 **Ver detalles:** [Aquí](https://www.virustotal.com/gui/url/${analysisId})`;
        }

        return `✅ **El enlace es seguro.**\n🔍 **Ver detalles:** [Aquí](https://www.virustotal.com/gui/url/${analysisId})`;

    } catch (error) {
        console.error('❌ Error al analizar el enlace:', error.response ? error.response.data : error.message);
        return '⚠️ **No se pudo analizar el enlace con VirusTotal.**';
    }
}


// Asegurarse de que haya configuración para el servidor
function ensureServerConfig(guildId) {
    if (!guildId) {
        console.error('Guild no disponible, no se puede asegurar la configuración.');
        return;
    }

    if (!config.servers[guildId]) {
        config.servers[guildId] = {
            antiLinks: false,
            logChannel: null
        };
        saveConfig();
    }
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

// Evento cuando el bot se une a un nuevo servidor
client.on(Events.GuildCreate, guild => {
    ensureServerConfig(guild.id);  // Aquí se asegura que el servidor tenga una configuración
    console.log(`✅ Nuevo servidor añadido: ${guild.name} (${guild.id})`);
});

client.on(Events.InteractionCreate, async interaction => {
    try {
        if (!interaction.isChatInputCommand()) return;

        const { commandName, member, guild, options } = interaction;

        // Asegurarse de que el comando solo puede ser usado por el creador del bot
        if (commandName === 'servers' && interaction.user.id !== process.env.USER_ID) {
            return interaction.reply({
                content: '❌ No tienes permisos para usar este comando.',
                ephemeral: true
            });
        }

        if (!guild) {
            return interaction.reply({ content: 'Este comando solo puede ser usado en un servidor.', ephemeral: true });
        }

        // Asegurarse de que haya configuración para el servidor
        ensureServerConfig(guild.id);

        if (commandName === 'ping') {
            await interaction.reply('🏓 Pong!');
        } else if (commandName === 'coinflip') {
            const result = Math.random() < 0.5 ? '🍀 Cara' : '💰 Cruz';
            await interaction.reply(`El resultado de la tirada es: ${result}`);
        } else if (commandName === 'botinfo') {
            const botInfo = new EmbedBuilder()
                .setColor('#0099ff')
                .setTitle('Información del Bot')
                .setDescription('Aquí están los detalles sobre el bot:')
                .addFields(
                    { name: 'Nombre', value: client.user.username, inline: true },
                    { name: 'ID', value: client.user.id, inline: true },
                    { name: 'Creador', value: 'MZXN', inline: true },
                    { name: 'Fecha de Creación', value: '22 de enero de 2025', inline: true },
                    { name: 'Versión', value: '3.1.0', inline: true }  // Mostrando la versión
                )
                .setThumbnail(client.user.displayAvatarURL({ dynamic: true }))
                .setTimestamp()
                .setFooter({ text: `Solicitado por ${interaction.user.tag}`, iconURL: interaction.user.displayAvatarURL() });
        
            await interaction.reply({ embeds: [botInfo] });
        
        } else if (commandName === 'hola') {
            await interaction.reply('👋 ¡Hola!');
        } else if (commandName === 'servers') {
            let response = '🤖 Estoy en los siguientes servidores:\n';
        
            // Iterar sobre todos los servidores en los que está el bot
            for (const [id, guild] of client.guilds.cache) {
                try {
                    // Agregar el nombre, ID del servidor y miembros a la respuesta
                    response += `**${guild.name}** (ID: ${guild.id}) - ${guild.memberCount} miembros\n`;
                } catch (error) {
                    console.error(`Error al obtener la información para ${guild.name}:`, error);
                    response += `**${guild.name}** - ❌ Error al obtener la información\n`;
                }
            }
        
            // Responder con la lista de servidores, IDs y miembros
            await interaction.reply(response);
        
        // Aquí puedes continuar con el resto de tus comandos, como 'mute' y otros
        } else if (commandName === 'mute') {
            const user = options.getUser('usuario');
            const time = options.getString('tiempo'); // tiempo en minutos
            const member = await guild.members.fetch(user.id);
        
            if (!member) {
                return interaction.reply({ content: 'Usuario no encontrado', ephemeral: true });
            }
        
            // Aplicar mute
            await member.timeout(parseInt(time) * 60000, 'Mute por tiempo especificado');
        
            // Guardar en mutes.json
            muteUser(user.id, time);
        
            await interaction.reply(`✅ El usuario ${user.tag} ha sido muteado por ${time} minutos.`);
        
            // Desmute después del tiempo especificado
            setTimeout(async () => {
                await member.timeout(null); // Elimina el timeout
                await interaction.followUp(`🔊 El usuario ${user.tag} ha sido desmuteado.`);
        
                // Eliminar de mutes.json
                unmuteUser(user.id);
            }, parseInt(time) * 60000); // Tiempo en minutos convertido a milisegundos

        } else if (commandName === 'unmute') {
            const user = options.getUser('usuario');
            const member = await guild.members.fetch(user.id);
        
            if (!member) {
                return interaction.reply({ content: 'Usuario no encontrado', ephemeral: true });
            }
        
            await member.timeout(null); // Elimina el timeout
            unmuteUser(user.id); // Eliminar de mutes.json
        
            await interaction.reply(`✅ El usuario ${user.tag} ha sido desmuteado.`);
        

        } else if (commandName === 'ban') {
            const user = options.getUser('usuario');
            const time = options.getString('tiempo'); // tiempo en días
            const member = await guild.members.fetch(user.id);
        
            if (!member) {
                return interaction.reply({ content: 'Usuario no encontrado', ephemeral: true });
            }
        
            // Aplicar ban
            await member.ban({ reason: 'Baneo temporal' });
        
            // Guardar en bans.json
            banUser(user.id, time);
        
            await interaction.reply(`✅ El usuario ${user.tag} ha sido baneado por ${time} días.`);
        
            // Desbaneado después del tiempo especificado
            setTimeout(async () => {
                await guild.members.unban(user.id);
                await interaction.followUp(`🔓 El usuario ${user.tag} ha sido desbaneado.`);
        
                // Eliminar de bans.json
                unbanUser(user.id);
            }, parseInt(time) * 86400000); // Tiempo en días convertido a milisegundos     

        } else if (commandName === 'unban') {
            const userId = options.getString('usuario');
            const user = await client.users.fetch(userId);
        
            await guild.members.unban(user.id);
        
            // Eliminar del bans.json
            unbanUser(userId);
        
            await interaction.reply(`✅ El usuario ${user.tag} ha sido desbaneado.`);

        } else if (commandName === 'anti_links_enable') {
            if (config.servers[guild.id].antiLinks) {
                return interaction.reply('⚠️ **El anti-links ya está activado en este servidor.**');
            }
            config.servers[guild.id].antiLinks = true;
            saveConfig();
            await interaction.reply('✅ **Anti-links de este servidor ha sido activado**.');
        } else if (commandName === 'anti_links_disable') {
            if (!config.servers[guild.id].antiLinks) {
                return interaction.reply('⚠️ **El anti-links ya está desactivado en este servidor.**');
            }
            config.servers[guild.id].antiLinks = false;
            saveConfig();
            await interaction.reply('✅ **Anti-links de este servidor ha sido desactivado**.');
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
            if (!channel) {
                return interaction.reply({ content: '❌ El canal especificado no es válido.', ephemeral: true });
            }

            // Configuración de logs
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
        
        } else if (commandName === 'scanlink') {
            const url = options.getString('url');
            if (!url) {
                return interaction.reply({ content: '❌ Debes proporcionar un enlace para analizar.', ephemeral: true });
            }
        
            await interaction.deferReply(); // Esperar la respuesta de VirusTotal
        
            const result = await scanUrlWithVirusTotal(url);
            await interaction.editReply(result);
        
        } else if (commandName === 'help') {  // ✅ Ahora está bien
        
            const embed = new EmbedBuilder()
                .setColor(0x0099ff)
                .setTitle('📜 Lista de Comandos')
                .setDescription('Aquí están todos los comandos disponibles en el bot:')
                .addFields(
                    { name: '/ping', value: '🏓 Comprueba la latencia del bot.' },
                    { name: '/hola', value: '👋 Saluda al bot.' },
                    { name: '/coinflip', value: '🪙 Lanza una moneda al aire.' },  
                    { name: '/botinfo', value: 'ℹ️ Muestra información sobre el bot.' },  
                    { name: '/servers', value: '🖥️ Muestra los servidores en los que está el bot. *Solo el dueño del bot puede usar este comando.*' },  
                    { name: '/mute', value: '🔇 Mutea a un usuario por un tiempo.' },  
                    { name: '/unmute', value: '🔊 Desmutea a un usuario.' },  
                    { name: '/ban', value: '🚫 Banea a un usuario por un tiempo.' },  
                    { name: '/unban', value: '🔓 Desbanea a un usuario.' },
                    { name: '/scanlink', value: '🔍 Escanea un link para detectar si es malicioso.' },
                    { name: '/anti_links_enable', value: '🚫 Activa el anti-links para bloquear invitaciones de Discord.' },
                    { name: '/anti_links_disable', value: '✅ Desactiva el anti-links.' },
                    { name: '/serverinfo', value: '📌 Muestra información del servidor.' },
                    { name: '/userinfo', value: '👤 Muestra información detallada del usuario.' },
                    { name: '/setlogs', value: '📂 Configura un canal para registrar logs de eventos.' },
                    { name: '/help', value: '📜 Muestra esta lista de comandos.' }
                )
                .setFooter({ text: 'Usa los comandos en cualquier canal disponible.' });

            await interaction.reply({ embeds: [embed] });
        }
    } catch (error) { // ✅ AHORA EL CATCH ESTÁ BIEN COLOCADO
        console.error('Error al ejecutar el comando:', error);
        await interaction.reply({ content: '❌ Hubo un error al ejecutar el comando.', ephemeral: true });
    }
});


client.on(Events.MessageCreate, async (message) => {
    // Verifica si el mensaje proviene de un servidor
    if (!message.guild) return;

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

// Función auxiliar para verificar permisos del bot
async function checkBotPermissions(channel) {
    const permissions = channel.permissionsFor(client.user);
    if (!permissions || !permissions.has(PermissionsBitField.Flags.SendMessages)) {
        console.error('❌ El bot no tiene permisos para enviar mensajes en este canal');
        return false;
    }
    return true;
}

// Evento cuando un mensaje es eliminado
client.on(Events.MessageDelete, async (message) => {
    if (!message.guild || !config.servers[message.guild.id]) return;

    const logChannelId = config.servers[message.guild.id]?.logChannel;
    if (!logChannelId) return;

    const logChannel = message.guild.channels.cache.get(logChannelId);
    if (!logChannel) return;

    const embed = new EmbedBuilder()
        .setColor('#FF0000')
        .setTitle('🗑 Mensaje Eliminado')
        .setDescription(`**Autor:** ${message.author.tag}\n**Canal:** ${message.channel}\n**Mensaje:** ${message.content || 'Contenido no disponible'}`)
        .setTimestamp();

    let uploadedUrls = [];

    // Si el mensaje eliminado tenía archivos adjuntos (imágenes, GIFs, videos)
    if (message.attachments.size > 0) {
        for (const attachment of message.attachments.values()) {
            const imgurLink = await uploadToImgur(attachment.url);
            if (imgurLink) uploadedUrls.push(imgurLink);
        }
    }

    // Agregar los enlaces subidos al embed
    if (uploadedUrls.length > 0) {
        embed.addFields({ name: '📎 Archivos subidos a Imgur:', value: uploadedUrls.join('\n') });
    }

    // Enviar el embed al canal de logs
    try {
        await logChannel.send({ embeds: [embed] });
    } catch (error) {
        console.error('❌ Error al enviar mensaje de log:', error);
    }
});


// Evento para registrar logs cuando un usuario es baneado
client.on(Events.GuildBanAdd, async (ban) => {
    // Verifica si ban.guild está disponible
    if (!ban.guild || !config.servers[ban.guild.id]) return;

    const logChannelId = config.servers[ban.guild.id].logChannel;
    if (!logChannelId) return;

    const logChannel = ban.guild.channels.cache.get(logChannelId);
    if (!logChannel) return;

    const embed = new EmbedBuilder()
        .setColor('#FF0000')
        .setTitle('🚨 Usuario Baneado')
        .setDescription(`**Usuario:** ${ban.user.tag}\n🆔 ID: ${ban.user.id}`)
        .setTimestamp();

    // Verificar permisos del bot en el canal de logs
    if (await checkBotPermissions(logChannel)) {
        try {
            await logChannel.send({ embeds: [embed] });
        } catch (error) {
            console.error('❌ No se pudo enviar el mensaje de log:', error);
        }
    }
});

// Conectar cliente a Discord
client.login(process.env.TOKEN);
