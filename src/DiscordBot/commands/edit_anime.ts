import { SlashCommandBuilder } from "@discordjs/builders";
import { CommandInteraction } from "discord.js";

module.exports = {
  data: new SlashCommandBuilder()
    .setName("edit_anime")
    .setDescription("Edits an anime entry if needed")
    .addStringOption((option) =>
      option
        .setName("anime_id")
        .setDescription("The Anime ID in order to modify the DB")
        .setRequired(true)
    )
    .addStringOption((option) =>
      option
        .setName("starting_episode")
        .setDescription("The starting episode of the anime")
        .setRequired(false)
    ),
  async execute(interaction: CommandInteraction) {
    const options = interaction.options.data;
    const animeid = options.find((option) => option.name === "animeid");
    const starting_episode = options.find(
      (option) => option.name === "starting_episode"
    );

    console.log(animeid!.value, starting_episode!.value);

    await interaction.reply("Successfully modified!");
  },
};
