import { SlashCommandBuilder } from "@discordjs/builders";
import { CommandInteraction } from "discord.js";
import db from "../../database/db";

module.exports = {
  data: new SlashCommandBuilder()
    .setName("delete_entry")
    .setDescription("Deletes an anime entry")
    .addStringOption((option) =>
      option
        .setName("anime_id")
        .setDescription("The Anime ID in order to modify the DB")
        .setRequired(true)
    ),
  async execute(interaction: CommandInteraction) {
    const options = interaction.options.data;
    const animeid = options.find((option) => option.name === "anime_id");
    await interaction.deferReply({ ephemeral: true });
    await db.deleteAnimeEntry(animeid!.value as string);
    await interaction.editReply({
      embeds: [
        {
          title: "Success",
          description: `Anime entry ${animeid!.value} has been deleted`,
          color: 0x00ff00,
        },
      ],
    });
  },
};
