// This um retrieves something from nyaa.si rss
// and returns it as a json object

import Parser from "rss-parser";
import { AnimeTorrent, Resolution } from "../utils/types";
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

  private similarity(s1: string, s2: string) {
    var longer = s1;
    var shorter = s2;
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

  private getNumbers(start: number, end: number): number[] {
    let numbers = [];
    for (let i = start + 1; i <= end; i++) {
      numbers.push(i);
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
    animeList: any[],
    startEpisode: number,
    endEpisode: number
  ): Promise<AnimeTorrent[]> {
    let animeTorrentList: any[] = new Array();

    for (let i = 0; i < animeList.length; i++) {
      const anime = animeList[i];

      const episodeList = this.getNumbers(startEpisode, endEpisode);
      for (let j = 0; j < episodeList.length; j++) {
        // console.log(
        //   "Downloading",
        //   anime.media.title.romaji,
        //   "\nEpisode",
        //   episodeList[j]
        // );

        const episode = episodeList[j];
        let episodeString = this.legitAddAZero(episode);

        var animeRSS = await this.getTorrent(
          anime.media.title.romaji,
          episodeString,
          resolution as Resolution
        );
        // Check if animeRSS is empty
        if (Object.keys(animeRSS).length > 0) animeTorrentList.push(animeRSS);
      }
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
    episodeNumber: string,
    resolution: Resolution
  ): Promise<AnimeTorrent> {
    const finalQuery = searchQuery + " - " + episodeNumber;

    this.rssLink =
      "https://nyaa.si/?page=rss&q=" + encodeURIComponent(finalQuery);
    ("&c=1_2&f=0");
    let rss;
    console.log(this.rssLink);

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

    // Iterate through rss.items
    // Check if the title contains mentions of both the query and resolution
    for (const item of rss.items) {
      let title: string = item.title;
      let subGroup = title.match(/^(.*?)\]/);
      title = title.replace(/^(.*?)\]/, "").trim();
      let animeTitle = title.match(/.*(?=\-)/);
      title = title.replace(/.*-/, "").trim();
      let episode = title.match(/[0-9]{2}/);
      title = title.replace(/[0-9]{2}/, "").trim();
      let res = title.match(/[\[\(][0-9]*?p[\]\)]/);

      if (subGroup && animeTitle && episode && res) {
        const titleSim = this.similarity(animeTitle[0].trim(), searchQuery);
        const episodeSim = this.similarity(episode[0].trim(), episodeNumber);

        if (
          titleSim > 0.8 &&
          episodeSim > 0.8 &&
          title.indexOf(resolution) > -1
        ) {
          item.episode = episode[0].trim();
          return item;
        }
      }
    }
    console.log(searchQuery, "not found");

    return {} as AnimeTorrent;
  }
}

export default new Nyaa();
