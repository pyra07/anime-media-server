// This retrieves something from nyaa.si rss
// and returns it as a json object

import Parser from "rss-parser";
import { AnimeTorrent, AniQuery, Resolution } from "../utils/types";
import { resolution } from "../../profile.json";
import { findBestMatch } from "string-similarity";

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
    /* Here we check whether the anime has recently finished airing.
       Usually batches aren't produced until like 1-2 week(s) after finishing */
    // const todayDate = new Date();
    // const endDate = new Date(
    //   `${anime.media.endDate.month}/${anime.media.endDate.day}/${anime.media.endDate.year}`
    // );
    // const daysLeft = Math.floor(
    //   (todayDate.getTime() - endDate.getTime()) / (1000 * 60 * 60 * 24)
    // );

    // Find movie
    if (anime.media.format === "MOVIE") {
      const animeRSS = await this.getTorrent(
        anime.media.title.romaji,
        resolution as Resolution,
        false
      );
      if (animeRSS) return animeRSS;
    }
    /* Find batch of episodes to download if the
       Anime has already finished airing */
    if (
      anime.media.status === "FINISHED" &&
      startEpisode === 0 &&
      fsDownloadedEpisodes.length === 0
    ) {
      const animeRSS = await this.getTorrent(
        anime.media.title.romaji,
        resolution as Resolution,
        true
      );
      if (animeRSS) return animeRSS;
    }

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
        false,
        episodeString
      );
      // Check if animeRSS is not null
      if (animeRSS !== null) animeTorrentList.push(animeRSS);
    }
    if (animeTorrentList.length === 0) return null;
    return animeTorrentList;
  }

  /**
   * Gets the torrent info for a specific anime and episode
   * @param  {string} searchQuery
   * @param  {Resolution} resolution
   * @param  {boolean} isBatch
   * @param  {string} episodeNumber
   * @returns {Promise<AnimeTorrent>}
   */
  private async getTorrent(
    searchQuery: string,
    resolution: Resolution,
    isBatch: boolean,
    episodeNumber?: string
  ): Promise<AnimeTorrent | null> {
    const finalQuery = isBatch
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

    // Sort rss.items by nyaa:seeders
    rss.items.sort((a: { [x: string]: string }, b: { [x: string]: string }) => {
      return parseInt(b["nyaa:seeders"], 10) - parseInt(a["nyaa:seeders"], 10);
    });

    // Iterate through rss.items
    // Check if the title contains mentions of both the query and resolution
    for (const item of rss.items) {
      let title: string = item.title;
      let subGroup = title.match(/\[(.*?)\]/);
      if (isBatch || (!isBatch && episodeNumber == undefined)) {
        let animeTitle = title.match(/(?<=\[.*\])(.+?) (?=[\(\[])/);

        // If animetitle is found, check similarity and if it's above the threshold, return
        if (animeTitle) {
          const isSimilar = this.verifyQuery(searchQuery, animeTitle);
          if (isSimilar) return item as AnimeTorrent;
        }
      } else {
        const epRegexLength = episodeNumber ? episodeNumber.length : 2;

        let animeTitle =
          title.match(
            new RegExp("\\[.*\\] (.+?) - \\d{" + epRegexLength + "}")
          ) ??
          title.match(new RegExp("\\[.*\\]_(.+?)_\\d{" + epRegexLength + "}"));

        let episode =
          title.match(new RegExp("(?<=- )\\d{" + epRegexLength + "}")) ??
          title.match(new RegExp("(?<=_)\\d{" + epRegexLength + "}(?=_)"));

        if (animeTitle && episode && episodeNumber) {
          const isSimilar = this.verifyQuery(
            searchQuery,
            animeTitle,
            episodeNumber,
            episode
          );

          // If the title and episode are similar, and the resolution is similar, return
          if (isSimilar && title.includes(resolution)) {
            item.episode = episodeNumber;
            return item as AnimeTorrent;
          }
        }
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

  private verifyQuery(
    searchQuery: string,
    animeTitleRegex: RegExpMatchArray,
    episode?: string,
    episodeRegex?: RegExpMatchArray
  ) {
    const animeTitle = animeTitleRegex[1].trim();

    // If animeTitle has a title in round brackets, extract it. If found, extract the title out of the brackets
    const subAnimeTitle = animeTitle.match(/(?<=\().+?(?=\))/);
    const subAnimeTitleString = subAnimeTitle ? subAnimeTitle[0] : "";
    const mainAnimeTitle = animeTitle.replace(/\(.+?\)/, "").trim();

    const animeBestMatch = findBestMatch(searchQuery, [
      animeTitle,
      mainAnimeTitle,
      subAnimeTitleString,
    ]);

    const isEpisode =
      episodeRegex && episode ? episodeRegex[0] === episode : true;

    return animeBestMatch.bestMatch.rating > 0.7 && isEpisode;
  }
}

export default new Nyaa();
