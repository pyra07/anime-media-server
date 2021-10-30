
/*
{
  match: {
    match_id: '71028303',
    name: 'OWC2020: (Canada) VS (Germany)',
    start_time: '2020-12-05 17:45:09',
    end_time: '2020-12-05 18:49:27'
  },
  games: [
    {
      game_id: '371607549',
      start_time: '2020-12-05 18:05:30',
      end_time: '2020-12-05 18:09:28',
      beatmap_id: '2719302',
      play_mode: '0',
      match_type: '0',
      scoring_type: '3',
      team_type: '2',
      mods: '1',
      scores: [Array]
    },
    {
      game_id: '371609535',
      start_time: '2020-12-05 18:12:47',
      end_time: '2020-12-05 18:15:51',
      beatmap_id: '2719439',
      play_mode: '0',
      match_type: '0',
      scoring_type: '3',
      team_type: '2',
      mods: '0',
      scores: [Array]
    },
    {
      game_id: '371611141',
      start_time: '2020-12-05 18:18:44',
      end_time: '2020-12-05 18:23:05',
      beatmap_id: '2719386',
      play_mode: '0',
      match_type: '0',
      scoring_type: '3',
      team_type: '2',
      mods: '17',
      scores: [Array]
    },
    {
      game_id: '371613443',
      start_time: '2020-12-05 18:27:10',
      end_time: '2020-12-05 18:29:43',
      beatmap_id: '2719893',
      play_mode: '0',
      match_type: '0',
      scoring_type: '3',
      team_type: '2',
      mods: '65',
      scores: [Array]
    },
    {
      game_id: '371614905',
      start_time: '2020-12-05 18:32:32',
      end_time: '2020-12-05 18:35:56',
      beatmap_id: '2719305',
      play_mode: '0',
      match_type: '0',
      scoring_type: '3',
      team_type: '2',
      mods: '1',
      scores: [Array]
    },
    {
      game_id: '371616786',
      start_time: '2020-12-05 18:39:28',
      end_time: '2020-12-05 18:41:53',
      beatmap_id: '2719437',
      play_mode: '0',
      match_type: '0',
      scoring_type: '3',
      team_type: '2',
      mods: '0',
      scores: [Array]
    },
    {
      game_id: '371618075',
      start_time: '2020-12-05 18:44:26',
      end_time: '2020-12-05 18:47:08',
      beatmap_id: '2719373',
      play_mode: '0',
      match_type: '0',
      scoring_type: '3',
      team_type: '2',
      mods: '17',
      scores: [Array]
    }
  ]
}
Assign a type similar to the above to the variable `match`
*/
export interface Match {
    match: {
        match_id: string;
        name: string;
        start_time: string;
        end_time: string;
    };
    games: Game[];
}

export interface Game {
    game_id: string;
    start_time: string;
    end_time: string;
    beatmap_id: string;
    play_mode: string;
    match_type: string;
    scoring_type: string;
    team_type: string;
    mods: string;
    scores: Score[];
}

export interface Score {
    team: string;
    user_id: string;
    score: string;
    max_combo: string;
    count_50: string;
    count_100: string;
    count_300: string;
    count_miss: string;
    count_katu: string;
    count_geki: string;
    perfect: string;
    mods: string;
}