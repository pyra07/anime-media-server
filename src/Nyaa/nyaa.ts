/* This retrieves something from nyaa.si rss, does some verification
 and returns it as a json object */

import Parser from "rss-parser";
import { AnimeTorrent, AniQuery, Resolution, SearchMode } from "../utils/types";
import { resolution } from "../../profile.json";
import { compareTwoStrings } from "string-similarity";
import anitomy from "anitomy-js";

class Nyaa {
  rssLink: URL;
  parser: any;
  constructor() {
    this.rssLink = new URL("https://nyaa.si/");
    this.parser = new Parser({
      customFields: {
        item: ["nyaa:seeders"],
      },
    });
  }

  /**
   * Gets the numbers between start and end
   * @param  {number} start
   * @param  {number} end
   * @returns {number[]}
   */

  private getNumbers(
    start: number,
    inBetween: number[],
    end: number
  ): number[] {
    let numbers = [];
    for (let i = start + 1; i <= end; i++) {
      if (inBetween.indexOf(i) === -1) numbers.push(i);
    }
    return numbers;
  }

  /**
   * Determines which animes need to be downloaded or something.
   * Pass in your anime list entries and see the magic happen.
   * @param {object} animeList
   * @returns {Promise<any>}
   */
  public async getTorrents(
    anime: AniQuery,
    startEpisode: number,
    endEpisode: number,
    fsDownloadedEpisodes: number[]
  ): Promise<AnimeTorrent[] | AnimeTorrent | null> {
    // Find movie
    if (anime.media.format === "MOVIE") {
      const animeRSS = await this.getTorrent(
        anime.media.title.romaji,
        resolution as Resolution,
        SearchMode.MOVIE
      );
      if (animeRSS) return animeRSS;
    } else if (
      /* Find batch of episodes to download if the
       Anime has already finished airing */
      anime.media.status === "FINISHED" &&
      startEpisode === 0 &&
      fsDownloadedEpisodes.length === 0
    ) {
      const animeRSS = await this.getTorrent(
        anime.media.title.romaji,
        resolution as Resolution,
        SearchMode.BATCH
      );
      if (animeRSS) return animeRSS;
    } else if (anime.media.format === "TV") {
      const animeTorrentList: AnimeTorrent[] = new Array();

      // Generate a list of episodes to download
      const episodeList = this.getNumbers(
        startEpisode,
        fsDownloadedEpisodes,
        endEpisode
      );

      // Search for episodes individually
      for (let j = 0; j < episodeList.length; j++) {
        const episode = episodeList[j];
        const episodeString =
          episodeList.length >= 100
            ? episode >= 10 && episode <= 99
              ? "0" + episode
              : episode >= 100
              ? episode.toString()
              : "00" + episode
            : episode < 10
            ? "0" + episode
            : episode.toString();

        const animeRSS = await this.getTorrent(
          anime.media.title.romaji,
          resolution as Resolution,
          SearchMode.EPISODE,
          episodeString
        );

        if (animeRSS !== null) animeTorrentList.push(animeRSS); // Check if animeRSS is not null
      }

      return animeTorrentList.length ? animeTorrentList : null;
    }
    return null;
  }

  /**
   * Gets the torrent info for a specific anime and episode
   * @param {string} searchQuery The title of the anime to look for
   * @param {Resolution} resolution The resolution to search for
   * @param {SearchMode} searchMode What format we expect to search
   * @param {string} episodeNumber The episode number to search for, if applicable
   * @returns {Promise<AnimeTorrent>} The anime torrent object. Used to load and download the torrent
   */
  private async getTorrent(
    searchQuery: string,
    resolution: Resolution,
    searchMode: SearchMode,
    episodeNumber?: string
  ): Promise<AnimeTorrent | null> {
    const finalQuery =
      searchMode === SearchMode.BATCH
        ? `${searchQuery} Batch`
        : episodeNumber
        ? `${searchQuery} - ${episodeNumber}`
        : searchQuery;

    // Set some filters, and then the search query
    this.rssLink.searchParams.set("page", "rss");
    this.rssLink.searchParams.set("q", finalQuery);
    this.rssLink.searchParams.set("c", "1_2");
    this.rssLink.searchParams.set("f", "0");

    try {
      var rss = await this.parser.parseURL(this.rssLink.href);
    } catch (error) {
      console.log(
        "An error has occured while trying to retreive the RSS feed from Nyaa:\n",
        error
      );
      return null;
    }

    if (rss.items.length === 0) return null; // Guard against empty rss

    // Sort rss.items by nyaa:seeders
    rss.items.sort((a: { [x: string]: string }, b: { [x: string]: string }) => {
      return parseInt(b["nyaa:seeders"], 10) - parseInt(a["nyaa:seeders"], 10);
    });

    /* Iterate through rss.items
    Check if the title contains mentions of both the query and resolution */
    for (const item of rss.items) {
      let title: string = item.title;
      const animeParsedData = anitomy.parseSync(title);

      const isSimilar = this.verifyQuery(
        searchQuery,
        animeParsedData,
        resolution,
        searchMode,
        episodeNumber
      );

      // If the title and episode are similar, and the resolution is similar, return
      if (isSimilar) {
        item.episode = episodeNumber;
        return item as AnimeTorrent;
      }
    }
    console.log(searchQuery, "-", episodeNumber ?? "", "not found");
    return null;
  }
  /**
   * Verifies if the query has some degree of similarity to the media to look for, based on the input given.
   * @param  {string} searchQuery The title of the anime to originally verify
   * @param  {anitomy.AnitomyResult} animeParsedData The parsed data of the RSS item title
   * @param  {Resolution} resolution The resolution to verify
   * @param  {SearchMode} searchMode What to expect from the query. This can be in multiple forms
   * @param  {string} episode? The episode number to verify, if applicable
   */
  private verifyQuery(
    searchQuery: string,
    animeParsedData: anitomy.AnitomyResult,
    resolution: Resolution,
    searchMode: SearchMode,
    episode?: string
  ) {
    const parsedTitle = animeParsedData.anime_title;
    const parsedResolution = animeParsedData.video_resolution;

    if (!parsedTitle || !parsedResolution) return false; // Guard against empty parsed data

    // Check if info is similar
    const titleMatch = compareTwoStrings(searchQuery, parsedTitle);
    const resolutionMatch = parsedResolution.includes(resolution);

    if (titleMatch < 0.7 && !resolutionMatch) return false; // If title is not similar, and resolution is not similar, return false

    switch (searchMode) {
      case SearchMode.EPISODE:
        const parsedEpisode = animeParsedData.episode_number;

        if (!parsedEpisode) return false; // Guard against empty episode

        const episodeMatch = parseInt(episode!) === parseInt(parsedEpisode); // Check if episode is similar

        return episodeMatch; // Return if all conditions are met

      case SearchMode.BATCH:
        const parsedReleaseInfo = animeParsedData.release_information;

        if (!parsedReleaseInfo) return false; // Guard against empty release info

        const batchMatch = parsedReleaseInfo.includes("Batch"); // Check if it is a batch

        return batchMatch; // Return if all conditions are met

      case SearchMode.MOVIE:
        const parsedAnimeType = animeParsedData.anime_type;

        if (!parsedAnimeType) return false; // Guard against empty anime type

        const movieMatch = parsedAnimeType.includes("Movie"); // Check if it is a movie

        return movieMatch; // Return if all conditions are met

      case SearchMode.ONA || SearchMode.OVA:
        const parsedAnimeType2 = animeParsedData.anime_type;

        if (!parsedAnimeType2) return false; // Guard against empty anime type

        const onaMatch =
          parsedAnimeType2.includes("ONA") || parsedAnimeType2.includes("OVA"); // Check if it is an ONA or OVA

        return onaMatch; // Return if all conditions are met

      default:
        return false;
    }
  }
}

export default new Nyaa();
