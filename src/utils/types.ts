export type Resolution = "480" | "720" | "1080";
export type status = "FINISHED" | "RELEASING" | "NOT_YET_RELEASED";

/*************************************************************************************** */

export interface AnimeTorrent {
  title: string;
  link: string;
  pubDate: string;
  "nyaa:seeders": string;
  content: string;
  contentSnipet: string;
  guid: string;
  isoDate: string;
  episode: string;
}

export interface nextAiringEpisode {
  episode: number;
  id: number;
}

export interface AniQuery {
  progress: number;
  mediaId: number;
  media: {
    episodes: number;
    status: status;
    nextAiringEpisode: nextAiringEpisode | null;
    title: {
      romaji: string;
      english: string;
      native: string;
    };
    coverImage: {
      extraLarge: string;
      large: string;
      medium: string;
      color: string;
    };
  };
}
