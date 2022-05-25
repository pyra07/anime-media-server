import cron from "cron";
import Anilist from "../Anilist/anilist";
import DB from "../database/db";
import Nyaa from "../Nyaa/nyaa";
import firebase from "firebase";
import qbit from "../qBitTorrent/qbit";
import { AnimeTorrent, AniQuery } from "../utils/types";
import { MessageBuilder, Webhook } from "discord-webhook-node";
import { webhook } from "../../profile.json";
import { log } from "console";

class Scheduler {
  private hook: Webhook; // Store discord webhook info
  private offlineAnimeDB: { [key: string]: Array<number> };
  constructor() {
    this.hook = new Webhook(webhook);
    this.offlineAnimeDB = {};
  }

  /**
   * Runs the scheduler periodically every x minutes
   */
  public async run(cronTime: string, clearDB: boolean): Promise<void> {
    const job = new cron.CronJob(
      cronTime,
      async () => {
        log(`Running scheduler at ${new Date().toLocaleString()}`); // log with current time
        await this.check();
      },
      null,
      true,
      "Asia/Muscat"
    );
    if (clearDB)
      new cron.CronJob(
        "0 */6 * * *",
        () => {
          log(`Clearing offlineDB at ${new Date().toLocaleString()}`); // log with current time
          this.clearOfflineDB();
        },
        null,
        true,
        "Asia/Muscat"
      );
  }
  /**
   * Clears the offlineDB
   * @param  {string} mediaId? - If specified, only clears that anime
   * @returns void
   */
  public clearOfflineDB(mediaId?: string): void {
    if (mediaId) this.offlineAnimeDB[mediaId] = [];
    else this.offlineAnimeDB = {};
  }

  /**
   * Downloads the torrents, and updates the database
   * @param  {AniQuery} anime
   * @param  {boolean} isBatch
   * @param  {AnimeTorrent[]} ...animeTorrent
   * @returns Promise<void>
   */
  private async downloadTorrents(
    anime: AniQuery,
    isBatch: boolean,
    ...animeTorrent: AnimeTorrent[]
  ): Promise<void> {
    const downloadedEpisodes = new Array<number>();
    for (const torrent of animeTorrent) {
      log(`Downloading ${torrent.title} ${torrent.episode} at ${torrent.link}`);
      // Download torrent
      var isAdded: boolean = await qbit.addTorrent(
        torrent.link,
        anime.media.title.romaji,
        torrent.episode
      );
      if (isAdded)
        if (isBatch)
          downloadedEpisodes.push(
            ...Array.from({ length: anime.media.episodes }, (_, i) => i + 1)
          );
        else if (torrent.episode)
          downloadedEpisodes.push(parseInt(torrent.episode));
    }

    // Append to offlineDB
    this.offlineAnimeDB[anime.mediaId] = downloadedEpisodes;

    this.hook.send(
      new MessageBuilder()
        .setTimestamp()
        .setTitle(`**${anime.media.title.romaji}** is downloading!`)
        .setColor(0x0997e3)
        .addField("Title ID", anime.mediaId.toString(), true)
        .addField("Episode(s)", this.joinArr(downloadedEpisodes), true)
        .addField(
          "Seeders",
          animeTorrent.map((t) => t["nyaa:seeders"]).join(", "),
          true
        )
        .addField("Title", animeTorrent[0].title, true)
        .setImage(anime.media.coverImage.extraLarge)
    );

    await DB.modifyAnimeEntry(anime.mediaId.toString(), {
      "media.nextAiringEpisode": anime.media.nextAiringEpisode,
      "media.status": anime.media.status,
      downloadedEpisodes: firebase.firestore.FieldValue.arrayUnion(
        ...downloadedEpisodes
      ),
    });
  }
  /**
   * Displays the the range of an array
   * @param  {any[]} array
   * @returns {string} - Range of array
   */
  private joinArr(array: any[]) {
    if (array.length === 1) {
      return array[0];
    }
    return `${array[0]} - ${array[array.length - 1]}`;
  }

  /**
   * Handles the anime, and downloads the necessary torrents
   * @param  {AniQuery} anime
   * @returns Promise
   */
  private async handleAnime(anime: AniQuery): Promise<void> {
    log(`Handling ${anime.media.title.romaji}`);
    let fireDBAnime;

    try {
      const fireDBEntry = await DB.getByMediaId(`${anime.mediaId}`);

      if (!fireDBEntry.exists) {
        DB.addToDb(anime);
        fireDBAnime = anime;
      } else fireDBAnime = fireDBEntry.data();
    } catch (error) {
      console.error(error);
      return;
    }

    if (!fireDBAnime) return; // Guard against null fireDBAnime (in case of error)

    /* This is manually defined in the db by the user.
    Some animes usually have a 2nd season, but instead of starting from episode 1, they start from
    where they left off in season 1., e.g episode 13 
    Apparently, there is a workaround for this... */
    const startingEpisode = fireDBAnime.media.startingEpisode
      ? fireDBAnime.media.startingEpisode
      : 0;

    /* Sometimes the title found in nyaa.si is different.
    Therefore, we manually define an alt title if applicable. */
    anime.media.title.romaji =
      fireDBAnime.media.alternativeTitle ?? anime.media.title.romaji;

    const startEpisode = anime.progress + startingEpisode; // Users progress

    // NextAiringEpisode can be null if the anime is finished. So check for that
    const endEpisode = anime.media.nextAiringEpisode
      ? anime.media.nextAiringEpisode.episode - 1 + startingEpisode
      : anime.media.episodes;

    // firestore (fs) downloaded episodes.
    const fsDownloadedEpisodes: any[] = fireDBAnime.downloadedEpisodes || [];

    // Make array of anime.progress until endEpisode
    const animeProgress: number[] = Array.from(
      { length: endEpisode - startEpisode },
      (_, i) => i + startEpisode + 1
    );

    /* If progress is up to date, then skip
    Or if the user has downloaded all episodes, then skip */
    const isUpToDate = animeProgress.every((episode) =>
      fsDownloadedEpisodes.includes(episode)
    );

    if (isUpToDate) {
      // If the user is up to date, then we can skip, and update the offlineDB
      this.offlineAnimeDB[anime.mediaId] = fsDownloadedEpisodes;
      return;
    }

    // Attempt to find the anime.
    const isSuccessful = await this.getTorrents(
      anime,
      startEpisode,
      endEpisode,
      fsDownloadedEpisodes
    );

    if (isSuccessful) return; // Finish the function if successful

    // For new entries, sometimes you need to use a different title.
    if (
      !fireDBAnime.media.alternativeTitle &&
      fsDownloadedEpisodes.length === 0
    ) {
      // Loop over synonyms and find the one that matches a nyaa hit
      const synonyms = [anime.media.title.english, ...anime.media.synonyms];
      for (const synonym of synonyms) {
        //TODO If synonym is not in English, skip
        anime.media.title.romaji = synonym;
        const isValidTitle = await this.getTorrents(
          anime,
          startEpisode,
          endEpisode,
          fsDownloadedEpisodes
        );
        /* If we found a valid title, then we can stop looping.
           Add the title to firebase */
        if (isValidTitle) {
          DB.modifyAnimeEntry(anime.mediaId.toString(), {
            "media.alternativeTitle": synonym,
          });
          break;
        }
      }
    }
  }
  /**
   * Gets the torrents from nyaa.si
   * @param  {AniQuery} anime - Anime to get torrents for
   * @param  {number} start - Starting episode
   * @param  {number} end - Ending episode
   * @param  {any[]} fsDownloadedEpisodes - Episodes downloaded by firestore
   * @returns Promise<boolean> - If successful
   */
  private async getTorrents(
    anime: AniQuery,
    start: number,
    end: number,
    fsDownloadedEpisodes: any[]
  ): Promise<boolean> {
    const torrents = await Nyaa.getTorrents(
      anime,
      start,
      end,
      fsDownloadedEpisodes
    );

    if (torrents === null) return false; // Guard against null torrents (in case of error)

    if (Array.isArray(torrents))
      // Proceed to download them using qbit
      await this.downloadTorrents(anime, false, ...torrents);
    else await this.downloadTorrents(anime, true, torrents);
    return true;
  }
  /**
   * Main function. If there is a new anime, or new episode, then this function will execute.
   * This also uses the offlineAnimeDB to check if the user is up to date.
   */
  public async check() {
    const animeDb: AniQuery[] = await Anilist.getAnimeUserList();

    if (animeDb.length === 0) return; // check if animeDb is empty

    await new Promise<void>((resolve) => {
      animeDb.map((anime) => {
        if (!this.offlineAnimeDB.hasOwnProperty(anime.mediaId))
          this.handleAnime(anime);
        else {
          const episodesOffline = this.offlineAnimeDB[anime.mediaId];
          const airingEpisodes = anime.media.nextAiringEpisode
            ? anime.media.nextAiringEpisode.episode - 1
            : anime.media.episodes;
          // Handle if it needs more downloading
          if (episodesOffline[episodesOffline.length - 1] !== airingEpisodes)
            this.handleAnime(anime);
        }
      });
      resolve();
    });

    // await Promise.all(
    //   animeDb.map((anime) => {
    //     if (!this.offlineAnimeDB.hasOwnProperty(anime.mediaId))
    //       this.handleAnime(anime);
    //     else {
    //       const episodesOffline = this.offlineAnimeDB[anime.mediaId];
    //       const airingEpisodes = anime.media.nextAiringEpisode
    //         ? anime.media.nextAiringEpisode.episode - 1
    //         : anime.media.episodes;
    //       // Handle if it needs more downloading
    //       if (episodesOffline[episodesOffline.length - 1] !== airingEpisodes)
    //         this.handleAnime(anime);
    //     }
    //   })
    // );
  }
}

export default new Scheduler();
