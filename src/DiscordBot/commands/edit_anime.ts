import { SlashCommandBuilder } from "@discordjs/builders";
import { CommandInteraction } from "discord.js";
import db from "../../database/db";

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
        .setName("anime_alt_title")
        .setDescription("The Anime alternative title")
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
    const animeid = options.find((option) => option.name === "anime_id");
    const animealt = options.find(
      (option) => option.name === "anime_alt_title"
    );
    const starting_episode = options.find(
      (option) => option.name === "starting_episode"
    );
    await db.modifyAnimeEntry(animeid!.value as string, {
      "media.alternativeTitle": animealt!.value as string,
      "media.startingEpisode": starting_episode
        ? (starting_episode.value as number)
        : 0,
    });

    await interaction.reply("Successfully modified!");
  },
};
