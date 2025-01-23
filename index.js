require('dotenv').config(); // Cargar las variables de entorno

const { Client, GatewayIntentBits, PermissionsBitField, Events } = require("discord.js");

// Crear nuevo cliente Discord
const client = new Client({
    intents: [
        GatewayIntentBits.Guilds,
        GatewayIntentBits.GuildMessages,
        GatewayIntentBits.MessageContent,
        GatewayIntentBits.GuildMembers
    ]
});

// Configuración de moderación
let autoDeleteInvites = false; // Configuración inicial: Desactivado

// Evento cuando el bot está listo
client.once(Events.ClientReady, () => {
    console.log(`Bot conectado como ${client.user.tag}`);
});

// Función para enviar logs al canal de logs
function sendLog(channel, message) {
    if (!channel) return;
    channel.send(message);
}

// Evento para manejar mensajes
client.on(Events.MessageCreate, async (message) => {
    // Evitar responder a bots
    if (message.author.bot) return;

    // Si la moderación de invitaciones está activada, eliminar mensajes con enlaces de invitaciones
    if (autoDeleteInvites && message.content.match(/discord\.gg\/[a-zA-Z0-9]+/)) {
        // Eliminar el mensaje
        await message.delete();
        message.channel.send(`🚨 ${message.author}, no se permiten invitaciones a otros servidores. Has sido suspendido durante 10 minutos.`)
            .then(msg => setTimeout(() => msg.delete(), 5000)); // Eliminar la advertencia después de 5 segundos

        // Suspender al usuario por 10 minutos
        const suspensionDuration = 10 * 60 * 1000; // 10 minutos en milisegundos
        try {
            await message.member.timeout(suspensionDuration, "Envío de invitación no autorizada.");
        } catch (error) {
            console.error("Error al suspender al usuario:", error);
            return message.channel.send("⚠️ No se pudo suspender al usuario. Asegúrate de que el bot tenga los permisos necesarios.");
        }

        // Enviar log de la moderación
        const logChannel = message.guild.channels.cache.get('1305077832329986088'); // Canal de logs con el ID proporcionado
        sendLog(logChannel, `🚨 ${message.author.tag} fue suspendido por intentar enviar una invitación a otro servidor.`);

        return;
    }

    const prefix = "!";
    if (!message.content.startsWith(prefix)) return;

    const args = message.content.slice(prefix.length).trim().split(/ +/);
    const command = args.shift().toLowerCase();

    // Comando para activar la moderación de enlaces
    if (command === "anti" && args[0] === "links" && args[1] === "enable") {
        if (!message.member.permissions.has(PermissionsBitField.Flags.Administrator)) {
            return message.reply("❌ No tienes permisos para activar esta función.");
        }
        if (autoDeleteInvites) {
            return message.reply("⚠️ La eliminación automática de invitaciones ya está activada.");
        }

        autoDeleteInvites = true;
        message.channel.send("✅ **Anti links de servidores ha sido activado**.");

        // Enviar log de la activación de la moderación
        const logChannel = message.guild.channels.cache.get('1305077832329986088'); // Canal de logs con el ID proporcionado
        sendLog(logChannel, `✅ La moderación de enlaces ha sido activada por ${message.author.tag}.`);
    }

    // Comando para desactivar la moderación de enlaces
    if (command === "anti" && args[0] === "links" && args[1] === "disable") {
        if (!message.member.permissions.has(PermissionsBitField.Flags.Administrator)) {
            return message.reply("❌ No tienes permisos para desactivar esta función.");
        }
        if (!autoDeleteInvites) {
            return message.reply("⚠️ La eliminación automática de invitaciones ya está desactivada.");
        }

        autoDeleteInvites = false;
        message.channel.send("✅ **Anti links de servidores ha sido desactivado**.");

        // Enviar log de la desactivación de la moderación
        const logChannel = message.guild.channels.cache.get('1305077832329986088'); // Canal de logs con el ID proporcionado
        sendLog(logChannel, `❌ La moderación de enlaces ha sido desactivada por ${message.author.tag}.`);
    }

    // Comando para mostrar la información del servidor
    if (command === "serverinfo") {
        // Asegurarse de que los canales están cargados
        if (!message.guild.channels.cache.size) {
            await message.guild.channels.fetch();
        }

        const textChannels = message.guild.channels.cache.filter(c => c.type === "GUILD_TEXT" && c.viewable).size;
        const voiceChannels = message.guild.channels.cache.filter(c => c.type === "GUILD_VOICE" && c.viewable).size;

        const serverEmbed = {
            color: 0x1E90FF,
            title: `Información del Servidor: ${message.guild.name}`,
            thumbnail: {
                url: message.guild.iconURL(),
            },
            fields: [
                {
                    name: "🆔 ID del Servidor",
                    value: message.guild.id,
                    inline: true,
                },
                {
                    name: "📅 Creación del Servidor",
                    value: message.guild.createdAt.toDateString(),
                    inline: true,
                },
                {
                    name: "👑 Dueño del Servidor",
                    value: `<@${message.guild.ownerId}>`,
                    inline: true,
                },
                {
                    name: "💬 Miembros",
                    value: `${message.guild.memberCount} miembros`,
                    inline: true,
                },
                {
                    name: "🎤 Canales de Voz",
                    value: voiceChannels.toString(),
                    inline: true,
                },
                {
                    name: "💬 Canales de Texto",
                    value: textChannels.toString(),
                    inline: true,
                },
                {
                    name: "🚀 Boosts de Servidor",
                    value: message.guild.premiumSubscriptionCount.toString(),
                    inline: true,
                },
                {
                    name: "🔰 Roles",
                    value: message.guild.roles.cache.size.toString(),
                    inline: true,
                },
                {
                    name: "🔗 Región del Servidor",
                    value: message.guild.region || "No disponible",
                    inline: true,
                },
            ],
            footer: {
                text: "Comando ejecutado",
                icon_url: message.guild.iconURL(),
            },
            timestamp: new Date(),
        };

        // Evitar el envío doble
        const sentMessages = await message.channel.messages.fetch({ limit: 10 });
        if (sentMessages.some(msg => msg.embeds.length && msg.embeds[0].title === serverEmbed.title)) {
            return; // No enviar si el mismo embed ya fue enviado
        }

        message.channel.send({ embeds: [serverEmbed] });
    }

    // Comando de ayuda
    if (command === "help") {
        const helpEmbed = {
            color: 0x0099ff,
            title: "Comandos del Bot",
            description: "Estos son los comandos disponibles para ti:",
            fields: [
                {
                    name: "!anti links enable",
                    value: "Activa la moderación automática de invitaciones.",
                },
                {
                    name: "!anti links disable",
                    value: "Desactiva la moderación automática de invitaciones.",
                },
                {
                    name: "!serverinfo",
                    value: "Muestra información del servidor.",
                },
                {
                    name: "!userinfo",
                    value: "Muestra información del usuario.",
                },
            ],
        };
        message.channel.send({ embeds: [helpEmbed] });
    }

    // Comando para mostrar la información del usuario
    if (command === "userinfo") {
        const member = message.guild.members.cache.get(message.author.id);
        const roles = member.roles.cache.filter(role => role.id !== message.guild.id).map(role => role.toString()).join(", ") || "Ninguno";

        const userEmbed = {
            color: 0xFF038D, // Color del embed (similar al de tu ejemplo)
            title: `${message.author.tag} ${member.presence ? `(${member.presence.status})` : ''}`,
            thumbnail: {
                url: message.author.avatarURL(),
            },
            fields: [
                {
                    name: "Usuario",
                    value: `**${message.author.tag}**\nID: ${message.author.id}\nNombre: ${message.author.username}`,
                },
                {
                    name: "Color",
                    value: member.displayHexColor !== "#000000" ? member.displayHexColor : "Sin color personalizado",
                },
                {
                    name: "Miembro desde",
                    value: `${member.joinedAt.toDateString()} (hace ${Math.floor((Date.now() - member.joinedAt) / (1000 * 60 * 60 * 24))} días)`,
                },
                {
                    name: "Miembro en Discord desde",
                    value: `${message.author.createdAt.toDateString()} (hace ${Math.floor((Date.now() - message.author.createdAt) / (1000 * 60 * 60 * 24))} días)`,
                },
                {
                    name: "Roles",
                    value: roles,
                },
            ],
            footer: {
                text: `Solicitado por: ${message.author.tag}`,
            },
            timestamp: new Date(),
        };
        message.channel.send({ embeds: [userEmbed] });
    }
});

// Evento para manejar eventos de membresía, como ingreso o salida de usuario
client.on(Events.GuildMemberAdd, (member) => {
    const logChannel = member.guild.channels.cache.get('1305077832329986088'); // Canal de logs con el ID proporcionado
    if (logChannel) {
        sendLog(logChannel, `🔔 ${member.user.tag} ha ingresado al servidor.`);
    }
});

client.on(Events.GuildMemberRemove, (member) => {
    const logChannel = member.guild.channels.cache.get('1305077832329986088'); // Canal de logs con el ID proporcionado
    if (logChannel) {
        sendLog(logChannel, `⚠️ ${member.user.tag} ha salido del servidor.`);
    }
});

// Conectar cliente a nuestra aplicación de Discord usando el token desde .env
client.login(process.env.TOKEN);
