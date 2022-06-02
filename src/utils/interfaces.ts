/*************************************************************************************** */
/**
 * @description This contains interfaces and enums used in this application.
 */
/*************************************************************************************** */

import { AnimeFormat, animeStatus, OfflineAnime } from "utils";

// This interface is used to store the torrent information from an anime retrieved in Nyaa.
interface AnimeTorrent {
    title: string;
    link: string;
    pubDate: string;
    "nyaa:seeders": string;
    content: string;
    contentSnipet: string;
    guid: string;
    isoDate: string;
    episode?: string;
  }
  
  // Helper interface for Media. It is used to store the next episode number, and the its ID.
  interface nextAiringEpisode {
    episode: number;
    id: number;
  }
  
  // Helper interface for Media. It is used to define the title of the anime. This can be in 3 different forms.
  interface AniTitle {
    romaji: string;
    english: string;
    native: string;
  }
  
  // Helper interface for Media. It is used to define the anime's cover art size.
  interface AniCoverImage {
    extraLarge: string;
    large: string;
    medium: string;
    color: string;
  }
  
  // The parent of AniMedia. This is what is retrieved from AniList. It contains user progress, and info about the anime itself.
  interface AniQuery {
    progress: number;
    mediaId: number;
    media: AniMedia;
  }
  
  // Main interface for the application. It is used to store the entire infromation about the anime.
  interface AniMedia {
    episodes: number;
    format: AnimeFormat;
    status: animeStatus;
    endDate: {
      year: number | null;
      month: number | null;
      day: number | null;
    };
    nextAiringEpisode: nextAiringEpisode | null;
    title: AniTitle;
    synonyms: string[];
    coverImage: AniCoverImage;
  }
  
  // For Discord Bot.
  interface Command {
    msg: string;
    cmd: Function;
  }
  
  // offline db
  interface OfflineDB {
    [key: string]: OfflineAnime;
  }

export { AnimeTorrent, nextAiringEpisode, AniTitle, AniCoverImage, AniQuery, AniMedia, Command, OfflineDB };