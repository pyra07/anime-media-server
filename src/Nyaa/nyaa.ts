// This um retrieves something from nyaa.si rss
// and returns it as a json object

import Parser from "rss-parser";
import { AnimeTorrent, Resolution } from "../utils/types";

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
  /**
   * Gets the numbers between start and end
   * @param  {number} start
   * @param  {number} end
   * @returns {number[]}
   */

  private getNumbers(start: number, end: number): number[] {
    let numbers = [];
    for (let i = start + 1; i < end; i++) {
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
  public async getTorrents(animeList: any[]): Promise<AnimeTorrent[]> {
    let animeTorrentList: any[] = new Array();

    for (let i = 0; i < animeList.length; i++) {
      const anime = animeList[i];
      var progress = anime.progress;
      var nextAiringEpisode = anime.media.nextAiringEpisode?.episode;

      if (!nextAiringEpisode) continue;

      const episodeList = this.getNumbers(progress, nextAiringEpisode);
      for (let j = 0; j < episodeList.length; j++) {
        console.log("Downloading", anime.media.title.romaji, "\nEpisode", episodeList[j]);

        const episode = episodeList[j];
        let episodeString = this.legitAddAZero(episode);

        var animeRSS = await this.getTorrent(
          anime.media.title.romaji,
          episodeString,
          "1080"
        );
        animeTorrentList.push(animeRSS);
      }
    }

    return animeTorrentList;
  }

  /**
   * Pass in [ANIME_NAME] - [EPISODE_NUMBER]. You should get data from Nyaa.si
   * @param  {string} searchQuery
   * @returns {Promise<AnimeTorrent>}
   */
  private async getTorrent(
    searchQuery: string,
    episodeNumber: string,
    resolution: Resolution
  ): Promise<AnimeTorrent> {
    searchQuery += " - " + episodeNumber;

    this.rssLink =
      "https://nyaa.si/?page=rss&q=" +
      searchQuery.split(" ").join("+") +
      "&c=1_2&f=0";

    const rss = await this.parser.parseURL(this.rssLink);

    // Sort rss.items by nyaa:seeders
    rss.items.sort((a: { [x: string]: string }, b: { [x: string]: string }) => {
      return parseInt(b["nyaa:seeders"], 10) - parseInt(a["nyaa:seeders"], 10);
    });

    // Iterate through rss.items
    // Check if the title contains mentions of both the query and resolution

    for (const item of rss.items) {
      if (
        item.title.toLowerCase().match(searchQuery.toLowerCase()) !== -1 &&
        item.title.toLowerCase().indexOf(resolution.toLowerCase()) !== -1
      ) {
        return item as AnimeTorrent;
      }
    }
    return {} as AnimeTorrent;
  }
}

export default Nyaa;
