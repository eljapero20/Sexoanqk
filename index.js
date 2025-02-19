require('dotenv').config();
const { Client, GatewayIntentBits, PermissionsBitField, Events, EmbedBuilder } = require("discord.js");
const axios = require('axios'); // Importar Axios para subir archivos a Imgur
const fs = require('fs'); // Importar el módulo fs
const xml2js = require('xml2js'); // Asegúrate de tener esto al inicio de tu archivo
const parser = new xml2js.Parser(); // Inicializa el parser XML


// Accediendo a las variables de entorno
// API key y login directamente en el código
const DANBOORU_API_KEY = 'DTkViCoSWkC7F519hu2Hc87f'; // Tu API key
const DANBOORU_LOGIN = 'MZXN'; // Tu login
const IMGUR_CLIENT_ID = process.env.IMGUR_CLIENT_ID; // Cargar Client ID de Imgur
const VIRUSTOTAL_API_KEY = process.env.VIRUSTOTAL_API_KEY; // Cargar API Key de VirusTotal

// Cargar el token del bot
const token = process.env.TOKEN;

// Verificar que el token se haya cargado correctamente
if (!token) {
    console.error('No se pudo cargar el token del bot. Asegúrate de que el archivo .env esté correctamente configurado.');
    process.exit(1);  // Terminar el proceso si no hay token
}

// Definir la función checkPermissions
function checkPermissions(interaction, permission) {
    if (!interaction.member.permissions.has(permission)) {
        return interaction.reply({ content: `❌ No tienes permisos para usar este comando.`, ephemeral: true });
    }

    if (!interaction.guild.members.me.permissions.has(permission)) {
        return interaction.reply({ content: `❌ No tengo permisos para ejecutar esta acción.`, ephemeral: true });
    }

    return true;
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
            
        } else if (commandName === 'rule34') {
            // Verificar si el comando es ejecutado en un canal NSFW
            if (!interaction.channel.nsfw) {
                return interaction.reply({
                    content: '❌ Este comando solo puede ser usado en canales con contenido NSFW.',
                    ephemeral: true,
                });
            }
        
            const tag = options.getString('tag');
            const numImages = options.getInteger('cantidad') || 1; // Número de imágenes (por defecto 1)
            const source = options.getString('source') || 'danbooru';  // Añadimos la opción de fuente (danbooru o rule34)
        
            if (!tag) {
                return interaction.reply({
                    content: '❌ Debes proporcionar una etiqueta para buscar.',
                    ephemeral: true,
                });
            }
        
            try {
                await interaction.deferReply();
            
                let posts = [];
                if (source === 'danbooru') {
                    const response = await axios.get(`https://danbooru.donmai.us/posts.json?tags=${tag}&limit=${numImages * 5}&api_key=${DANBOORU_API_KEY}&login=${DANBOORU_LOGIN}`);
                    console.log('Respuesta de Danbooru:', response.data); // Aquí agregamos el log para verificar la respuesta
                    posts = response.data; // La respuesta de Danbooru debería ser un array
                } else if (source === 'rule34') {
                    const xmlResponse = await axios.get(`https://rule34.xxx/index.php?page=dapi&s=post&q=index&tags=${tag}&limit=${numImages * 5}`);
                    
                    // Usamos xml2js para parsear la respuesta XML
                    parser.parseString(xmlResponse.data, (err, result) => {
                        if (err) {
                            console.error('Error al parsear XML de Rule34:', err);
                            return interaction.reply({
                                content: '❌ Hubo un error al procesar la respuesta de Rule34.',
                                ephemeral: true,
                            });
                        }
                        posts = result.posts.post; // La estructura después de parsear el XML
                    });
                }
            
                // Asegurarse de que 'posts' es un arreglo antes de usar .filter()
                if (!Array.isArray(posts)) {
                    return interaction.editReply({
                        content: '❌ Error al obtener datos, la respuesta no es válida.',
                        ephemeral: true,
                    });
                }
            
                // Si no se encuentran resultados
                if (posts.length === 0) {
                    return interaction.editReply({
                        content: '❌ No se encontraron resultados para esta etiqueta.',
                        ephemeral: true,
                    });
                }
            
                // Filtrar imágenes repetidas por el ID
                const sentPosts = new Set();
                const availablePosts = posts.filter(post => {
                    const postId = post.id;
                    if (sentPosts.has(postId)) {
                        return false;
                    }
                    sentPosts.add(postId);
                    return true;
                });
            
                if (availablePosts.length < numImages) {
                    return interaction.editReply({
                        content: `❌ No hay suficientes imágenes disponibles con esa etiqueta. Solo se encontraron ${availablePosts.length} imagen(es).`,
                        ephemeral: true,
                    });
                }
            
                // Mezclar las imágenes aleatoriamente para garantizar variedad
                const shuffledPosts = availablePosts.sort(() => Math.random() - 0.5);
            
                // Seleccionar las primeras imágenes disponibles
                const selectedPosts = shuffledPosts.slice(0, numImages);
            
                // Crear mensajes para imágenes y videos
const mediaMessages = [];

selectedPosts.forEach(post => {
    const postUrl = source === 'danbooru'
        ? `https://danbooru.donmai.us/posts/${post.id}`
        : `https://rule34.xxx/index.php?page=post&s=view&id=${post.id}`;

    if (post.file_url.endsWith('.mp4') || post.file_url.endsWith('.webm')) {
        // Enviar videos como enlaces directos para que Discord los reproduzca
        mediaMessages.push({
            content: `🎥 **Video de [${source}](${postUrl}):**\n${post.file_url}`,
        });
    } else {
        // Enviar imágenes como embeds
        mediaMessages.push({
            content: `🖼️ **Imagen de [${source}](${postUrl}):**`,
            embeds: [
                {
                    title: `Contenido de ${source}`,
                    url: postUrl,
                    image: { url: post.file_url },
                }
            ]
        });
    }
});

            
                // Enviar los mensajes generados (imágenes y videos)
for (const message of mediaMessages) {
    await interaction.followUp(message);
}

            
            } catch (error) {
                console.error('Error al obtener contenido:', error);
                return interaction.reply({
                    content: '❌ Hubo un error al obtener las imágenes o videos.',
                    ephemeral: true,
                });
            }
            
        } else if (commandName === 'servers') {
            let response = '🤖 Estoy en los siguientes servidores:\n';
        
            for (const [id, guild] of client.guilds.cache) {
                try {
                    response += `**${guild.name}** (ID: ${guild.id}) - ${guild.memberCount} miembros\n`;
                } catch (error) {
                    console.error(`Error al obtener la información para ${guild.name}:`, error);
                    response += `**${guild.name}** - ❌ Error\n`;
                }
            }
        
            if (response.length > 2000) {
                response = response.slice(0, 1997) + '...';
            }
        
            await interaction.reply(response);
        
        } else if (commandName === 'mute') {
            if (!checkPermissions(interaction, PermissionsBitField.Flags.ModerateMembers)) return;
        
            const user = options.getUser('usuario');
            let time = parseInt(options.getString('tiempo'));
        
            if (isNaN(time) || time <= 0) {
                return interaction.reply({ content: '❌ El tiempo debe ser un número positivo (en minutos).', ephemeral: true });
            }
        
            let targetMember;
            try {
                targetMember = await guild.members.fetch(user.id);
            } catch (error) {
                return interaction.reply({ content: '❌ No se pudo encontrar al usuario en este servidor.', ephemeral: true });
            }
        
            if (targetMember.isCommunicationDisabled()) {
                return interaction.reply({ content: '❌ El usuario ya está muteado.', ephemeral: true });
            }
        
            // Deferimos la respuesta para evitar que el bot se quede bloqueado
            await interaction.deferReply();
        
            try {
                // Aplicar mute (timeout)
                await targetMember.timeout(time * 60000, 'Mute por tiempo especificado');
                await interaction.followUp(`✅ El usuario ${user.tag} ha sido muteado por ${time} minutos.`);
        
                // Programar el desmute automático
                setTimeout(async () => {
                    try {
                        await targetMember.timeout(null);  // Desmutear al usuario después del tiempo
                        if (interaction.channel) {
                            await interaction.channel.send(`🔊 El usuario ${user.tag} ha sido desmuteado.`);
                        }
                    } catch (error) {
                        console.error(`Error al desmutear automáticamente a ${user.tag}:`, error);
                        await interaction.followUp({ content: `❌ Error al desmutear a ${user.tag}.`, ephemeral: true });
                    }
                }, time * 60000);  // Convertir el tiempo de minutos a milisegundos
        
            } catch (error) {
                console.error(`Error al mutear a ${user.tag}:`, error);
                await interaction.followUp({ content: `❌ Hubo un error al intentar mutear a ${user.tag}.`, ephemeral: true });
            }
        
        } else if (commandName === 'unmute') {
            if (!checkPermissions(interaction, PermissionsBitField.Flags.ModerateMembers)) return;
        
            const user = options.getUser('usuario');
            let member;
            
            try {
                member = await guild.members.fetch(user.id);
            } catch (error) {
                return interaction.reply({ content: '❌ No se pudo encontrar al usuario en este servidor.', ephemeral: true });
            }
        
            // Verificar si el usuario está muteado
            if (!member.isCommunicationDisabled()) {
                return interaction.reply({ content: '❌ El usuario no está muteado.', ephemeral: true });
            }
        
            // Deferimos la respuesta para evitar que el bot se quede bloqueado
            await interaction.deferReply();
        
            try {
                // Eliminar el mute (timeout)
                await member.timeout(null);  // Desmutear al usuario
        
                // Responder después de que se haya completado la acción
                await interaction.followUp(`✅ El usuario ${user.tag} ha sido desmuteado.`);
            } catch (error) {
                console.error(`Error al desmutear a ${user.tag}:`, error);
                await interaction.followUp({ content: `❌ Hubo un error al intentar desmutear a ${user.tag}.`, ephemeral: true });
            }
        
        
        } else if (commandName === 'ban') {
            if (!checkPermissions(interaction, PermissionsBitField.Flags.BanMembers)) return;
        
            const user = options.getUser('usuario');
            let time = parseInt(options.getString('tiempo'));
        
            if (isNaN(time) || time <= 0) {
                return interaction.reply({ content: '❌ El tiempo debe ser un número positivo (en días).', ephemeral: true });
            }
        
            let targetMember;
            try {
                targetMember = await guild.members.fetch(user.id);
            } catch (error) {
                return interaction.reply({ content: '❌ Usuario no encontrado en el servidor.', ephemeral: true });
            }
        
            // Aplicar ban
            await targetMember.ban({ reason: 'Baneo temporal' });
            await interaction.reply(`✅ El usuario ${user.tag} ha sido baneado por ${time} días.`);
        
            // Desbanear después del tiempo especificado
            setTimeout(async () => {
                try {
                    await guild.members.unban(user.id);  // Elimina el ban
                    await interaction.followUp(`🔓 El usuario ${user.tag} ha sido desbaneado.`);
                } catch (error) {
                    console.error(`Error al desbanear automáticamente a ${user.tag}:`, error);
                }
            }, time * 86400000);  // Convertir el tiempo de días a milisegundos
        
        
        } else if (commandName === 'unban') {
            if (!interaction.member.permissions.has(PermissionsBitField.Flags.BanMembers)) {
                return interaction.reply({ content: '❌ No tienes permisos para usar este comando.', ephemeral: true });
            }

            // Obtener el ID del usuario
            const userId = options.getString('id');

            // Verificar si el ID es válido
            if (!userId || isNaN(userId)) {
                return interaction.reply({ content: '❌ El ID proporcionado no es válido.', ephemeral: true });
            }

            try {
                // Verificar si el usuario está baneado
                const bannedUsers = await guild.bans.fetch();
                const userIsBanned = bannedUsers.has(userId);

                if (!userIsBanned) {
                    return interaction.reply({ content: '❌ El usuario no está baneado en este servidor.', ephemeral: true });
                }

                // Intentar desbanear al usuario
                await guild.members.unban(userId);
                await interaction.reply(`✅ El usuario con ID \`${userId}\` ha sido desbaneado.`);
            } catch (error) {
                console.error(`Error al desbanear al usuario con ID ${userId}:`, error);
                await interaction.reply({ content: `❌ No se pudo desbanear al usuario con ID \`${userId}\`. Verifica que esté baneado o que el ID sea correcto.`, ephemeral: true });
            }
                
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
                    { name: '/rule34', value: '🔞 Obtén imágenes o videos de Rule34 usando una etiqueta.' },
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
