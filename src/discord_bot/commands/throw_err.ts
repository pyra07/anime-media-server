import { SlashCommandBuilder } from "@discordjs/builders";
import { CommandInteraction } from "discord.js";

module.exports = {
  data: new SlashCommandBuilder()
    .setName("throw_err")
    .setDescription("Throws an error lol"),
  async execute(interaction: CommandInteraction) {
    await interaction.reply("Throw an error!");
    throw new Error("This is a test error");
  },
};
