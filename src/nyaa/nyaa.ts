/* This retrieves something from nyaa.si rss, does some verification
 and returns it as a json object */

import Parser from "rss-parser";
import { AnimeTorrent, AniQuery, Resolution, SearchMode } from "@utils/index";
import { getNumbers, verifyQuery } from "@nyaa/utils";
import {
  resolution,
  useProxy,
  nyaaUrl,
  altNyaaUrl,
  triggerGenre,
} from "profile.json";
import anitomy from "anitomy-js";
import axios from "axios";
import { proxy } from "@utils/models";

class Nyaa {
  private parser: any;
  constructor() {
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
  ): Promise<AnimeTorrent[] | AnimeTorrent | null> {
    let useAltUrl = false;

    if (anime.media.genres) {
      if (anime.media.genres.includes(triggerGenre)) useAltUrl = true;
    }

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
        [startEpisode.toString(), endEpisode.toString()],
        useAltUrl
      );

      if (batchTorrent) return batchTorrent;
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
        [episodeString],
        useAltUrl
      );

      if (torrent) torrents.push(torrent);
    }

    return torrents.length ? torrents : null;
  }

  private setParams(url: string, query: string): URL {
    const rssLink = new URL(url);

    // Set some filters, and then the search query
    rssLink.searchParams.set("page", "rss");
    rssLink.searchParams.set("q", query);
    // rssLink.searchParams.set("c", "1_2");
    rssLink.searchParams.set("f", "0");
    rssLink.searchParams.set("o", "desc");
    rssLink.searchParams.set("s", "seeders");

    return rssLink;
  }
  private async getResponse(rssLink: URL) {
    return await axios.get(
      rssLink.href,
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
    episodeRange: string[],
    useAltUrl: boolean
  ): Promise<AnimeTorrent | null> {
    const finalQuery =
      searchMode === SearchMode.EPISODE
        ? `${searchQuery} ${episodeRange[0]}`
        : searchQuery;

    // If useAltUrl is true, pass in the alt nyaa url to setParams function
    const url: string = useAltUrl ? altNyaaUrl : nyaaUrl;

    const rssLink = this.setParams(url, finalQuery);

    try {
      const response = await this.getResponse(rssLink);
      const rss = await this.parser.parseString(response.data);
      const items = rss.items;

      if (searchMode === SearchMode.EPISODE) {
        const finalQueryAlt = `${searchQuery} "E${episodeRange[0]}"`;
        const rssLinkAlt = this.setParams(url, finalQueryAlt);
        const responseAlt = await this.getResponse(rssLinkAlt);
        const rssAlt = await this.parser.parseString(responseAlt.data);
        items.push(...rssAlt.items);
      }

      if (items.length === 0) {
        return null;
      }

      items.sort(
        (a: { [x: string]: string }, b: { [x: string]: string }) =>
          parseInt(b["nyaa:seeders"]) - parseInt(a["nyaa:seeders"])
      );

      for (const item of items) {
        if (parseInt(item["nyaa:seeders"]) === 0) continue;

        const title = item.title;
        const animeParsedData = anitomy.parseSync(title);

        const isSimilar = verifyQuery(
          searchQuery,
          animeParsedData,
          useAltUrl ? Resolution.NONE : resolution,
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
