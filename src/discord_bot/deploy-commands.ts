import { REST } from "@discordjs/rest";
import { Routes } from "discord-api-types/v9";
import { clientId, guildId, token } from "profile.json";
import fs from "fs";

export async function deployCommands() {
  const commands: any[] = [];
  const commandFiles = fs
    .readdirSync("src/discord_bot/commands")
    .filter((file) => file.endsWith(".ts"));

  for (const file of commandFiles) {
    const command = require(`./commands/${file}`);
    commands.push(command.data.toJSON());
  }

  const rest = new REST({ version: "9" }).setToken(token);

  rest
    .put(Routes.applicationGuildCommands(clientId, guildId), { body: commands })
    .then(() => console.log("Successfully registered application commands."))
    .catch(console.error);
}
