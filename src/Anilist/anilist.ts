import axios from "axios";
import { aniUserName } from "profile.json";
import { AniQuery } from "utils";
class Anilist {
  api: string;
  authLink: string;

  constructor() {
    this.api = "https://graphql.anilist.co";
    this.authLink = "https://anilist.co/api/v2/oauth/token";
  }

  /**
   * Sends a POST req to the Anilist API with the given query and variables
   * @param  {string} query
   * @param  {Object} variables?
   * @returns Promise<any> - The response from the API
   */

  private async getData(query: string, variables?: Object): Promise<any> {
    return await axios(this.api, {
      headers: {
        Application: "application/json",
        "content-type": "application/json",
      },
      method: "post",
      data: {
        query,
        variables,
      },
    });
  }

  /**
   * Input a custom query with any variables you want to use
   * @param  {string} query
   * @param  {Object} variables?
   * @returns Promise
   */
  public async customQuery(query: string, variables?: Object): Promise<any> {
    const response = await this.getData(query, variables);
    return response.data;
  }

  /**
   * Returns what the user current WATCHING list is.
   * @returns Promise
   */
  public async getAnimeUserList(): Promise<AniQuery[]> {
    // I love loooong lines
    var query = `
    query ($userName :String) {
      MediaListCollection(userName: $userName, type: ANIME, status_in: CURRENT) {
        lists {
          name
          entries {
            progress
            mediaId
            media {
              coverImage {
                extraLarge
                large
                medium
                color
              }
              format
              episodes
              status
              endDate {
                year
                month
                day
              }
              nextAiringEpisode {
                id
                episode
              }
              synonyms
              title {
                romaji
                english
                native
              }
            }
          }
        }
      }
    }
    `;

    var variables = {
      userName: aniUserName,
    };

    // Errors can sometimes happen here, so we need to catch it
    try {
      let response = await this.getData(query, variables);
      response =
        response.data.data.MediaListCollection.lists.length > 0
          ? response.data.data.MediaListCollection.lists[0].entries
          : [];
      return response as AniQuery[];
    } catch (e) {
      console.error(e);
      return [] as AniQuery[];
    }
  }
}

export default new Anilist();
