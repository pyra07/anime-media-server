/* This retrieves something from nyaa.si rss, does some verification
 and returns it as a json object */

import Parser from "rss-parser";
import { AnimeTorrent, AniQuery, Resolution, SearchMode } from "../utils/types";
import { resolution } from "../../profile.json";
import { compareTwoStrings, findBestMatch } from "string-similarity";
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

  private editDistance(s1: string, s2: string) {
    s1 = s1.toLowerCase();
    s2 = s2.toLowerCase();

    var costs = new Array();
    for (var i = 0; i <= s1.length; i++) {
      var lastValue = i;
      for (var j = 0; j <= s2.length; j++) {
        if (i == 0) costs[j] = j;
        else {
          if (j > 0) {
            var newValue = costs[j - 1];
            if (s1.charAt(i - 1) != s2.charAt(j - 1))
              newValue = Math.min(Math.min(newValue, lastValue), costs[j]) + 1;
            costs[j - 1] = lastValue;
            lastValue = newValue;
          }
        }
      }
      if (i > 0) costs[s2.length] = lastValue;
    }
    return costs[s2.length];
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
        // Check if animeRSS is not null
        if (animeRSS !== null) animeTorrentList.push(animeRSS);
      }
      if (animeTorrentList.length === 0) return null;
      return animeTorrentList;
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

    this.rssLink.searchParams.set("page", "rss");
    this.rssLink.searchParams.set("q", finalQuery);
    this.rssLink.searchParams.set("c", "1_2");
    this.rssLink.searchParams.set("f", "0");

    let rss;

    try {
      rss = await this.parser.parseURL(this.rssLink.href);
    } catch (error) {
      console.log(error);
      return null;
    }

    // Guard against empty rss
    if (rss.items.length === 0) return null;

    // Sort rss.items by nyaa:seeders
    rss.items.sort((a: { [x: string]: string }, b: { [x: string]: string }) => {
      return parseInt(b["nyaa:seeders"], 10) - parseInt(a["nyaa:seeders"], 10);
    });

    // Iterate through rss.items
    // Check if the title contains mentions of both the query and resolution
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
    console.log(
      searchQuery,
      "-",
      episodeNumber ? episodeNumber : "Batch",
      "not found"
    );
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
    switch (searchMode) {
      case SearchMode.EPISODE:
        const parsedTitle = animeParsedData.anime_title;
        const parsedEpisode = animeParsedData.episode_number;
        const parsedResolution = animeParsedData.video_resolution;

        // Guard against undefined values
        if (!parsedTitle || !parsedEpisode || !parsedResolution) return false;

        // Check if info is similar
        const titleMatch = compareTwoStrings(searchQuery, parsedTitle);
        const episodeMatch = parseInt(episode!) === parseInt(parsedEpisode);
        const resolutionMatch = parsedResolution.includes(resolution);

        // If so, we have a match
        return titleMatch > 0.7 && episodeMatch && resolutionMatch;

      case SearchMode.BATCH:
        // TODO
        break;
      case SearchMode.MOVIE:
        // TODO
        break;
      default:
        return false;
    }
  }
}

export default new Nyaa();
