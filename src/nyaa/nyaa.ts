/* This retrieves something from nyaa.si rss, does some verification
 and returns it as a json object */

import Parser from "rss-parser";
import { AnimeTorrent, AniQuery, Resolution, SearchMode } from "@utils/index";
import { getNumbers, verifyQuery } from "@nyaa/utils";
import { resolution, useProxy } from "profile.json";
import anitomy from "anitomy-js";
import axios from "axios";
import { proxy } from "@utils/models";

class Nyaa {
  private rssLink: URL;
  private parser: any;
  constructor() {
    this.rssLink = new URL("https://nyaa.si/");
    this.parser = new Parser({
      customFields: {
        item: ["nyaa:seeders"],
      },
    });
  }

  /**
   * Finds torrents for the given anime and episodes
   * @param anime The anime object
   * @param startEpisode The starting episode number
   * @param endEpisode The ending episode number
   * @param downloadedEpisodes The episodes that have already been downloaded
   * @returns A list of torrents, or null if none are found
   */
  public async getTorrents(
    anime: AniQuery,
    startEpisode: number,
    endEpisode: number,
    downloadedEpisodes: number[]
  ): Promise<AnimeTorrent[] | null> {
    let searchMode =
      anime.media.status === "FINISHED" &&
      startEpisode === 0 &&
      downloadedEpisodes.length === 0
        ? SearchMode.BATCH
        : SearchMode.EPISODE;

    if (searchMode === SearchMode.BATCH) {
      const batchTorrent = await this.getTorrent(
        anime.media.title.romaji,
        resolution as Resolution,
        searchMode,
        [startEpisode.toString(), endEpisode.toString()]
      );

      if (batchTorrent) return [batchTorrent];
      searchMode = SearchMode.EPISODE;
    }

    const episodeList = getNumbers(
      startEpisode,
      endEpisode,
      downloadedEpisodes
    );
    const torrents: AnimeTorrent[] = [];

    for (const episode of episodeList) {
      const episodeString = episode < 10 ? `0${episode}` : `${episode}`;
      const torrent = await this.getTorrent(
        anime.media.title.romaji,
        resolution as Resolution,
        searchMode,
        [episodeString]
      );

      if (torrent) torrents.push(torrent);
    }

    return torrents.length ? torrents : null;
  }

  private setParams(finalQuery: string) {
    // Set some filters, and then the search query
    this.rssLink.searchParams.set("page", "rss");
    this.rssLink.searchParams.set("q", finalQuery);
    this.rssLink.searchParams.set("c", "1_2");
    this.rssLink.searchParams.set("f", "0");
    this.rssLink.searchParams.set("o", "desc");
    this.rssLink.searchParams.set("s", "seeders");
  }
  private async getResponse() {
    return await axios.get(
      this.rssLink.href,
      useProxy
        ? {
            proxy: proxy,
          }
        : {}
    );
  }

  /**
   * Query nyaa for the anime information. Then look through the RSS feed for the
   * torrent. The torrent is then verified and returned.
   * @param {string} searchQuery The title of the anime to look for
   * @param {Resolution} resolution The resolution of the video we expect
   * @param {SearchMode} searchMode What format we expect to search
   * @param {string} episodeRange The episode number to search for, if applicable
   * @returns {Promise<AnimeTorrent>} Returns the torrent info if a match is found, otherwise returns null
   */
  private async getTorrent(
    searchQuery: string,
    resolution: Resolution,
    searchMode: SearchMode,
    episodeRange: string[]
  ): Promise<AnimeTorrent | null> {
    const finalQuery =
      searchMode === SearchMode.EPISODE
        ? `${searchQuery} ${episodeRange[0]}`
        : searchQuery;

    this.setParams(finalQuery);

    try {
      const response = await this.getResponse();
      const rss = await this.parser.parseString(response.data);
      const items = rss.items;

      if (items.length === 0) {
        return null;
      }

      items.sort(
        (a: { [x: string]: string }, b: { [x: string]: string }) =>
          parseInt(b["nyaa:seeders"]) - parseInt(a["nyaa:seeders"])
      );

      for (const item of items) {
        const title = item.title;
        const animeParsedData = anitomy.parseSync(title);

        const isSimilar = verifyQuery(
          searchQuery,
          animeParsedData,
          resolution,
          searchMode,
          episodeRange
        );

        if (isSimilar) {
          // If the title and episode are similar, and the resolution is similar, return
          item.episode = episodeRange.length === 1 ? episodeRange[0] : "01";
          return item as AnimeTorrent;
        }
      }
    } catch (error) {
      console.error(
        "An error has occured while trying to retreive the RSS feed from Nyaa:",
        error
      );
      return null;
    }
    return null;
  }
}

export default new Nyaa();
