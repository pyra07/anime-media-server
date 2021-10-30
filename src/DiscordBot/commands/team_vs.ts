// Sends users current anime list
import { SlashCommandBuilder } from "@discordjs/builders";
import { log } from "console";
import { CommandInteraction } from "discord.js";
import anilist from "../../Anilist/anilist";
import osu from "../osu/osu";

module.exports = {
  data: new SlashCommandBuilder()
    .setName("team_versus")
    .setDescription("Compare scores between two teams!")
    .addStringOption((option) =>
      option
        .setName("mp_link_1")
        .setRequired(true)
        .setDescription("The first mp link")
    )
    .addStringOption((option) =>
      option
        .setName("team_color_1")
        .setRequired(true)
        .setDescription("The first team color. Can be either red or blue")
        .addChoices([
          ["Red", "1"],
          ["Blue", "2"],
        ])
    )
    .addStringOption((option) =>
      option
        .setName("mp_link_2")
        .setRequired(true)
        .setDescription("The second mp link")
    )
    .addStringOption((option) =>
      option
        .setName("team_color_2")
        .setRequired(true)
        .setDescription("The second team color. Can be either red or blue")
        .addChoices([
          ["Red", "1"],
          ["Blue", "2"],
        ])
    ),
  async execute(interaction: CommandInteraction) {
    const data = interaction.options.data;
    const mp_link_1 = data
      .find((option) => option.name === "mp_link_1")!
      .value!.toString();
    const team_color_1 = data.find(
      (option) => option.name === "team_color_1"
    )!.value;
    const mp_link_2 = data
      .find((option) => option.name === "mp_link_2")!
      .value!.toString();
    const team_color_2 = data.find(
      (option) => option.name === "team_color_2"
    )!.value;

    const matchID_1 = mp_link_1.split("/").pop();
    const matchID_2 = mp_link_2.split("/").pop();

    if (matchID_1 === undefined || matchID_2 === undefined) {
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
    const matchData_1 = await osu.getMatch(matchID_1);
    const matchData_2 = await osu.getMatch(matchID_2);
    const gameData_1 = matchData_1?.games;
    const gameData_2 = matchData_2?.games;

    if (gameData_1 === undefined || gameData_2 === undefined) {
      await interaction.editReply({
        embeds: [
          {
            title: "Error",
            description: "Error fetching match data",
            color: 0xff0000,
          },
        ],
      });
      return;
    }

    let team_1_score = 0;
    let team_2_score = 0;

    // Merge the two game data, which contain the same beatmap_id
    gameData_1.forEach((game) => {
      const game_2 = gameData_2.find((g) => g.beatmap_id === game.beatmap_id);
      if (game_2 !== undefined) {
        // Get scores for both teams, add them an
        console.log(game.scores, game_2.scores);
        
        const gameScore_1 = game.scores.reduce(
          (acc, cur) => acc + parseInt(cur.score),
          0
        );
        const gameScore_2 = game_2.scores.reduce(
          (acc, cur) => acc + parseInt(cur.score),
          0
        );
        console.log(gameScore_1, gameScore_2);
        
        if (gameScore_1 > gameScore_2) team_1_score += 1;
        else team_2_score += 1;
      }
    });
    await interaction.editReply({
        embeds: [
            {
                title: "Team VS",
                description: `Team 1: ${team_1_score} - Team 2: ${team_2_score}`,
                color: 0x00ff00,
            },
        ],
    });
  },
};
