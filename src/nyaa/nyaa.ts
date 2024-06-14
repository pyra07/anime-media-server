/* This retrieves something from nyaa.si rss, does some verification
 and returns it as a json object */

import Parser from "rss-parser";
import { AnimeTorrent, AniQuery, Resolution, SearchMode } from "@utils/index";
import { getNumbers, verifyQuery } from "@nyaa/utils";
import { resolution, proxyAddress, proxyPort, useProxy } from "profile.json";
import anitomy from "anitomy-js";
import axios from "axios";

class Nyaa {
  private rssLink: URL;
  private parser: any;
  constructor() {
    this.rssLink = new URL("https://nyaa.land/");
    this.parser = new Parser({
      customFields: {
        item: ["nyaa:seeders"],
      },
    });
  }

  /**
   * Determines which mode to use for the search
   * @param  {AniQuery} anime
   * @param  {number} startEpisode
   * @param  {number} endEpisode
   * @param  {number[]} fsDownloadedEpisodes
   * @returns Promise
   */
  public async getTorrents(
    anime: AniQuery,
    startEpisode: number,
    endEpisode: number,
    fsDownloadedEpisodes: number[]
  ): Promise<AnimeTorrent[] | AnimeTorrent | null> {
    /* Find batch of episodes to download if the
       anime has already finished airing.
       Assess if this is the best way to do this (might remove)
       Reason : This accepts all anime formats */
    if (
      anime.media.status === "FINISHED" &&
      startEpisode === 0 &&
      fsDownloadedEpisodes.length === 0
    ) {
      const animeRSS = await this.getTorrent(
        anime.media.title.romaji,
        resolution as Resolution,
        SearchMode.BATCH,
        [startEpisode.toString(), endEpisode.toString()]
      );
      if (animeRSS) return animeRSS;
      // Search for a releasing episode
    } else {
      const animeTorrentList: AnimeTorrent[] = new Array();

      // Generate a list of episodes to download
      const episodeList = getNumbers(
        startEpisode,
        endEpisode,
        fsDownloadedEpisodes
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
          [episodeString]
        );

        if (animeRSS !== null) animeTorrentList.push(animeRSS); // Check if animeRSS is not null
      }

      return animeTorrentList.length ? animeTorrentList : null;
    }
    return null;
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
            proxy: {
              protocol: "http",
              host: proxyAddress,
              port: proxyPort,
            },
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

    // Used proxy due to internet restrictions.
    try {
      const response = await this.getResponse();
      var rss = await this.parser.parseString(response.data);
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
      return parseInt(b["nyaa:seeders"]) - parseInt(a["nyaa:seeders"]);
    });

    /* Iterate through rss.items
    Check if the title contains mentions of both the query and resolution */
    for (const item of rss.items) {
      // if (item["nyaa:seeders"] === "0") continue;

      let title: string = item.title;
      const animeParsedData = anitomy.parseSync(title);

      const isSimilar = verifyQuery(
        searchQuery,
        animeParsedData,
        resolution,
        searchMode,
        episodeRange
      );

      console.log(isSimilar, finalQuery, "\n", title);

      if (isSimilar) {
        // If the title and episode are similar, and the resolution is similar, return
        item.episode = episodeRange.length === 1 ? episodeRange[0] : "01";
        return item as AnimeTorrent;
      }
    }
    return null;
  }
}

export default new Nyaa();
