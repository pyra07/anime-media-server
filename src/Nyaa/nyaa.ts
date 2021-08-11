// This um retrieves something from nyaa.si rss
// and returns it as a json object

import axios from "axios";
import Parser from "rss-parser";
import { Resolution } from "../utils/types";

class Nyaa {
  rssLink: string;
  parser: any;
  constructor() {
    this.rssLink = "https://nyaa.si/?page=rss";
    this.parser = new Parser({
      customFields: {
        item: ["nyaa:seeders", "nyaa:category"],
      },
    });
  }

  /**
   * Pass in [ANIME_NAME] - [EPISODE_NUMBER]. You should get data from Nyaa.si
   * @param  {string} searchQuery
   * @returns Promise
   */
  public async getRSS(
    searchQuery: string,
    resolution: Resolution
  ): Promise<any> {
    this.rssLink =
      "https://nyaa.si/?page=rss&q=" + searchQuery.split(" ").join("+");

    const rss = await this.parser.parseURL(this.rssLink);

    // Sort rss.items by nyaa:seeders
    rss.items.sort((a: { [x: string]: string }, b: { [x: string]: string }) => {
      // sort by nyaa:seeders
      return parseInt(b["nyaa:seeders"], 10) - parseInt(a["nyaa:seeders"], 10);
    });

    // Iterate through rss.items
    // Check if the title contains mentions of both the query and resolution
    // Ignore if nyaa:category is not "Anime - English-translated"

    for (const item of rss.items) {
      if (item["nyaa:category"] === "Anime - English-translated") {
        if (
          item.title.toLowerCase().indexOf(searchQuery.toLowerCase()) !== -1 &&
          item.title.toLowerCase().indexOf(resolution.toLowerCase()) !== -1
        ) {
          return item;
        }
      }
    }
    return null;

  }
}

export default Nyaa;
