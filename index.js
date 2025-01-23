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
                // (El resto del código del embed original permanece intacto)
            ],
            footer: {
                text: "Comando ejecutado",
                icon_url: message.guild.iconURL(),
            },
            timestamp: new Date(),
        };

        message.channel.send({ embeds: [serverEmbed] });
    }

    // Juegos añadidos: Piedra, papel o tijera
    if (command === "ppt") {
        const choices = ["piedra", "papel", "tijera"];
        const userChoice = args[0];
        const botChoice = choices[Math.floor(Math.random() * choices.length)];
        
        if (!choices.includes(userChoice)) {
            return message.channel.send("❌ Elección inválida. Usa `!ppt piedra`, `!ppt papel` o `!ppt tijera`.");
        }

        const result = userChoice === botChoice 
            ? "Empate!" 
            : (userChoice === "piedra" && botChoice === "tijera") ||
              (userChoice === "papel" && botChoice === "piedra") ||
              (userChoice === "tijera" && botChoice === "papel") 
              ? "¡Ganaste!" 
              : "¡Perdiste!";
        
        message.channel.send(`🤖 Yo escogí: **${botChoice}**. ${result}`);
    }
});

// Evento para manejar eventos de membresía
client.on(Events.GuildMemberAdd, (member) => {
    const logChannel = member.guild.channels.cache.get('1305077832329986088'); // Canal de logs
    if (logChannel) {
        sendLog(logChannel, `🔔 ${member.user.tag} ha ingresado al servidor.`);
    }
});

client.on(Events.GuildMemberRemove, (member) => {
    const logChannel = member.guild.channels.cache.get('1305077832329986088'); // Canal de logs
    if (logChannel) {
        sendLog(logChannel, `⚠️ ${member.user.tag} ha salido del servidor.`);
    }
});

// Conectar cliente a Discord usando el token
client.login(process.env.TOKEN);
