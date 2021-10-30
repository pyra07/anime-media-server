// Match Costs

import { SlashCommandBuilder } from "@discordjs/builders";
import { CommandInteraction } from "discord.js";
import { osuAPI } from "../../../profile.json";
import axios from "axios";
import osu from "../osu/osu";

module.exports = {
  data: new SlashCommandBuilder()
    .setName("mc")
    .setDescription("Calculates match costs")
    .addStringOption((option) =>
      option
        .setName("match_link")
        .setRequired(true)
        .setDescription("The match to calculate costs for")
    )
    .addStringOption((option) =>
      option
        .setName("warmups")
        .setRequired(false)
        .setDescription("The number of warmups to include in the calculation")
    ),
  async execute(interaction: CommandInteraction) {
    const options = interaction.options.data;
    const matchLink = options.find(
      (option) => option.name === "match_link"
    )!.name;
    // Check if the match link is valid and get the match id e.g https://osu.ppy.sh/community/matches/71028303
    const matchId = matchLink.split("/").pop();

    if (matchId === undefined) {
      await interaction.deferReply({ ephemeral: false });
      await interaction.editReply({
        embeds: [
          {
            title: "Error",
            description: "Invalid match link",
            color: 0xff0000,
          },
        ],
      });
      return;
    }
    await interaction.deferReply({ ephemeral: true });

    const warmups = options.find((option) => option.name === "warmups");
    const warmupCount = warmups ? parseInt(warmups.name) : 0;
    // GET request to osu api to get match data using axios
    const matchData = await osu.getMatch(matchId);
    // Check if the match is valid
    if (matchData === null) {
      await interaction.editReply({
        embeds: [
          {
            title: "Error",
            description:
              "Either this match doesn't exist or you don't have permission to view it",
            color: 0xff0000,
          },
        ],
      });
      return;
    }
    // Check if the match is a tournament match
    const teamType = matchData.games[0].team_type;
    // teamType = 2 is a tournament match
    if (teamType !== "2") {
      await interaction.editReply({
        embeds: [
          {
            title: "Error",
            description: "This match is not a tournament match",
            color: 0xff0000,
          },
        ],
      });
      return;
    }
    const team = [{}, {}];
    // Get the match cost
    const games = matchData.games;
    for (let index = 0 + warmupCount; index < games.length; index++) {
      const element = games[index];
      const scores = element.scores;
      for (const score of scores) {
        const teamIndex = score.team === "1" ? 0 : 1;
        const user = score.user_id;
      }
    }
  },
};
