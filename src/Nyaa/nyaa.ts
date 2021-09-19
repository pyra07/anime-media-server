// This um retrieves something from nyaa.si rss
// and returns it as a json object

import Parser from "rss-parser";
import { AnimeTorrent, AniQuery, Resolution } from "../utils/types";
import { resolution } from "../../profile.json";

class Nyaa {
  rssLink: string;
  parser: any;
  constructor() {
    this.rssLink = "https://nyaa.si/?page=rss";
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
   * Returns how closely similar two strings are to each other.
   * @param  {string} s1
   * @param  {string} s2
   */
  private similarity(s1: string, s2: string) {
    var longer = s1.toLowerCase();
    var shorter = s2.toLowerCase();
    if (s1.length < s2.length) {
      longer = s2;
      shorter = s1;
    }
    var longerLength = longer.length;
    if (longerLength == 0) {
      return 1.0;
    }
    return (
      (longerLength - this.editDistance(longer, shorter)) /
      parseFloat(longerLength.toString())
    );
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

  private legitAddAZero(number: number): string {
    if (number < 10) {
      return "0" + number;
    }
    return number.toString();
  }
  /**
   * Determines which animes need to be downloaded or something. Pass in your anime list entries and see the magic happen.
   * @param {object} animeList
   * @returns {Promise<any>}
   */
  public async getTorrents(
    anime: AniQuery,
    startEpisode: number,
    endEpisode: number,
    fsDownloadedEpisodes: number[]
  ): Promise<AnimeTorrent[] | AnimeTorrent> {
    if (
      anime.media.status === "FINISHED" &&
      startEpisode === 0 &&
      fsDownloadedEpisodes.length === 0
    ) {
      return await this.getTorrent(
        anime.media.title.romaji,
        resolution as Resolution,
        true
      );
    }

    let animeTorrentList: AnimeTorrent[] = new Array();

    // Generate a list of episodes to download
    const episodeList = this.getNumbers(
      startEpisode,
      fsDownloadedEpisodes,
      endEpisode
    );
    for (let j = 0; j < episodeList.length; j++) {
      const episode = episodeList[j];
      const episodeString = this.legitAddAZero(episode);

      const animeRSS = await this.getTorrent(
        anime.media.title.romaji,
        resolution as Resolution,
        false,
        episodeString
      );
      // Check if animeRSS is empty
      if (Object.keys(animeRSS).length > 0) animeTorrentList.push(animeRSS);
    }

    return animeTorrentList;
  }

  /**
   * Pass in [ANIME_NAME] - [EPISODE_NUMBER]. You should get data from Nyaa.si
   * @param  {string} searchQuery
   * @returns {Promise<AnimeTorrent>}
   */
  public async getTorrent(
    searchQuery: string,
    resolution: Resolution,
    isBatch: boolean,
    episodeNumber?: string
  ): Promise<AnimeTorrent> {
    const finalQuery = isBatch
      ? searchQuery + " Batch"
      : searchQuery + " - " + episodeNumber;

    this.rssLink =
      "https://nyaa.si/?page=rss&q=" +
      encodeURIComponent(finalQuery) +
      "&c=1_2&f=0";
    let rss;

    try {
      rss = await this.parser.parseURL(this.rssLink);
    } catch (error) {
      console.log(error);
      return {} as AnimeTorrent;
    }

    // Sort rss.items by nyaa:seeders
    rss.items.sort((a: { [x: string]: string }, b: { [x: string]: string }) => {
      return parseInt(b["nyaa:seeders"], 10) - parseInt(a["nyaa:seeders"], 10);
    });
    // console.log(`Found ${rss.items.length} items via ${this.rssLink}`);

    // Iterate through rss.items
    // Check if the title contains mentions of both the query and resolution
    for (const item of rss.items) {
      let title: string = item.title;
      let subGroup = title.match(/^(.*?)\]/);
      title = title.replace(/^(.*?)\]/, "").trim();
      if (isBatch) {
        let animeTitle = title.match(/[^\(]*/);
        title.replace(/[^\(]*/, "").trim();
        // If animetitle is found, check similarity and if it's above the threshold, return
        if (animeTitle) {
          const similarity = this.similarity(searchQuery, animeTitle[0]);
          if (similarity > 0.75) return item as AnimeTorrent;
        }
      } else {
        let animeTitle = title.match(/.*(?=\-)/);
        title = title.replace(/.*-/, "").trim();
        let episode = title.match(/[0-9]{2}/);
        title = title.replace(/[0-9]{2}/, "").trim();
        let res = title.match(/[\[\(][0-9]*?p[\]\)]/);

        if (subGroup && animeTitle && episode && res && episodeNumber) {
          const titleSim = this.similarity(animeTitle[0].trim(), searchQuery);
          const episodeSim = this.similarity(episode[0].trim(), episodeNumber);

          if (
            titleSim > 0.8 &&
            episodeSim > 0.8 &&
            title.includes(resolution)
          ) {
            item.episode = episode[0].trim();
            return item as AnimeTorrent;
          }
        }
      }
    }
    console.log(searchQuery, "not found");

    return {} as AnimeTorrent;
  }
}

export default new Nyaa();
