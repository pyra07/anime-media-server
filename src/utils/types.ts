// Type that contains 480 720 or 1080p resolution
export type Resolution = "480" | "720" | "1080";
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
