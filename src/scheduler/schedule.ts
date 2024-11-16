import cron from "cron";
import Anilist from "@ani/anilist";
import DB from "@db/db";
import Nyaa from "@nyaa/nyaa";
import qbit from "@qbit/qbit";
import pLimit from "p-limit";
import { handleWithDelay, joinArr } from "@scheduler/utils";
import { AnimeTorrent, AniQuery, OfflineAnime, OfflineDB } from "@utils/index";
import { MessageBuilder, Webhook } from "discord-webhook-node";
import { webhook } from "profile.json";
import { arrayUnion, DocumentData } from "firebase/firestore";

class Scheduler {
  private hook: Webhook; // Store discord webhook info
  private offlineAnimeDB: OfflineDB;
  private limit;

  constructor() {
    this.hook = new Webhook(webhook);
    this.offlineAnimeDB = {};
    this.limit = pLimit(4);
  }

  /**
   * Runs the scheduler periodically every x minutes
   * @param  {string} cronTime - Cron time
   * @param  {boolean} clearDB - If true, clears the offlineDB
   * @returns {Promise<void>}
   */
  public async run(cronTime: string): Promise<void> {
    let isRunning = false; // Lock to prevent overlapping jobs

    new cron.CronJob(
      cronTime,
      async () => {
        if (isRunning) {
          console.log("Previous job still running. Skipping this run.");
          return; // Exit if the previous job is still running
        }

        try {
          isRunning = true; // Lock the job execution
          console.log(
            `===============Running scheduler at ${new Date().toLocaleString()}===============`
          ); // Log with current time

          await this.check(); // Execute the job
        } catch (error) {
          console.error("Error during cron job execution:", error); // Handle any errors
        } finally {
          isRunning = false; // Release the lock when done
        }
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
  public runClearOfflineDB(cronTime: string, mediaId?: string): void {
    new cron.CronJob(
      cronTime,
      () => {
        this.clearOfflineDB();
      },
      null,
      true,
      "Asia/Muscat"
    );
  }

  public clearOfflineDB(mediaId?: string) {
    if (mediaId) this.offlineAnimeDB[mediaId] = new OfflineAnime([]);
    else this.offlineAnimeDB = {};
  }

  /**
   * Downloads the torrents, and updates the database
   * @param  {AniQuery} anime - The anime object
   * @param  {boolean} isBatch - If true, then a batch of episodes is being downloaded (e.g episodes 01-12)
   * @param  {AnimeTorrent[]} ...animeTorrent - The anime torrents returned from nyaa.si
   * @returns Promise<void>
   */
  private async downloadTorrents(
    anime: AniQuery,
    isBatch: boolean,
    ...animeTorrent: AnimeTorrent[]
  ): Promise<void> {
    const downloadedEpisodes = new Array<number>();
    for (const torrent of animeTorrent) {
      console.log(
        `Downloading ${torrent.title} ${torrent.episode} at ${torrent.link}`
      );
      // Download torrent
      var isAdded: boolean = await qbit.addTorrent(
        torrent.link,
        anime.media.title.romaji,
        torrent.episode
      );
      if (!isAdded) {
        this.offlineAnimeDB[anime.mediaId].setTimeout();
        return;
      }

      // If we successfully added the torrent, then add it to the database later
      if (isBatch)
        downloadedEpisodes.push(
          ...Array.from({ length: anime.media.episodes }, (_, i) => i + 1)
        );
      else if (torrent.episode)
        downloadedEpisodes.push(parseInt(torrent.episode));

      // Wait for 5 seconds
      await new Promise((resolve) => setTimeout(resolve, 5000));
    }

    // Append to offlineDB, and remove the timeout
    this.offlineAnimeDB[anime.mediaId].episodes = downloadedEpisodes;
    this.offlineAnimeDB[anime.mediaId].resetTimeout();

    const color = anime.media.coverImage.color
      ? Number(anime.media.coverImage.color.replace("#", "0x"))
      : 0x0997e3;

    // Inform the user via discord
    this.hook.send(
      new MessageBuilder()
        .setTimestamp()
        .setTitle(
          `**${anime.media.title.romaji} - ${joinArr(
            downloadedEpisodes
          )}** is downloading!`
        )
        .setColor(color)
        .addField("Title ID", anime.mediaId.toString(), true)
        .addField(
          "Seeders",
          animeTorrent.map((t) => t["nyaa:seeders"]).join(", "),
          true
        )
        .addField("Title", animeTorrent[0].title, true)
        .setImage(anime.media.coverImage.extraLarge)
    );
    // Update firestore
    await DB.modifyAnimeEntry(anime.mediaId.toString(), {
      "media.nextAiringEpisode": anime.media.nextAiringEpisode,
      "media.status": anime.media.status,
      downloadedEpisodes: arrayUnion(...downloadedEpisodes),
    });
  }
  /**
   * Handles an anime series, decides which episodes to download,
   * or actions to take.
   * @param  {AniQuery} anime - Anime object taken from userlist
   * @returns Promise
   */
  private async handleAnime(anime: AniQuery): Promise<void> {
    console.log(`Handling ${anime.media.title.romaji} ID ${anime.mediaId}`);
    let fireDBAnime: DocumentData;

    try {
      const fireDBEntry = await DB.getByMediaId(`${anime.mediaId}`);

      if (!fireDBEntry) {
        DB.addToDb(anime);
        fireDBAnime = anime as DocumentData;
      } else fireDBAnime = fireDBEntry;
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

    // Stupid, lazy implementation TODO remove
    this.offlineAnimeDB[anime.mediaId].starting_episode = startingEpisode;

    /* Sometimes the title found in nyaa.si is different.
    Therefore, we manually define an alt title if applicable. */
    anime.media.title.romaji =
      fireDBAnime.media.alternativeTitle ?? anime.media.title.romaji;

    const startEpisode = anime.progress + startingEpisode; // Users progress

    // NextAiringEpisode can be null if the anime is finished. So check for that
    const endEpisode = anime.media.nextAiringEpisode
      ? anime.media.nextAiringEpisode.episode - 1 + startingEpisode
      : anime.media.episodes + startingEpisode;

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
      this.offlineAnimeDB[anime.mediaId].episodes = fsDownloadedEpisodes.sort(
        (a, b) => a - b
      );

      return;
    }

    // Attempt to find the anime.
    const isAnimeFound = await this.getTorrents(
      anime,
      startEpisode,
      endEpisode,
      fsDownloadedEpisodes
    );

    if (isAnimeFound) return; // Finish the function if successful
    else this.offlineAnimeDB[anime.mediaId].setTimeout();

    // For new entries, sometimes you need to use a different title.
    if (
      !fireDBAnime.media.alternativeTitle &&
      fsDownloadedEpisodes.length === 0
    ) {
      // Get short name by seperating romaji title by colon
      const shortName = anime.media.title.romaji.split(":")[0];
      // Loop over synonyms and find the one that matches a nyaa hit
      const synonyms = [anime.media.title.english, ...anime.media.synonyms];
      if (shortName !== anime.media.title.romaji) synonyms.unshift(shortName);
      for (const synonym of synonyms) {
        if (!synonym) continue;
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
  /** Gets the torrents from nyaa.si
   * @param  {AniQuery} anime - Anime to get torrents for
   * @param  {number} start - Starting episode
   * @param  {number} end - Ending episode
   * @param  {any[]} fsDownloadedEpisodes - Episodes downloaded by firestore
   * @returns Promise<boolean> - If successful
   */ private async getTorrents(
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

    // If we found no torrents, then set a timeout to offlineDB
    if (torrents === null) {
      console.log(`No torrents found for ${anime.media.title.romaji}`);
      return false; // Guard against null torrents (error | not found)
    }

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
    const animeList: AniQuery[] = await Anilist.getAnimeUserList();

    if (animeList.length === 0) return;

    const promises: AniQuery[] = [];

    for (const anime of animeList) {
      
      if (!this.offlineAnimeDB.hasOwnProperty(anime.mediaId)) {
        this.offlineAnimeDB[anime.mediaId] = new OfflineAnime([]);
        promises.push(anime);
      } else {
        const offlineAnime = this.offlineAnimeDB[anime.mediaId];

        if (!!offlineAnime.timeouts) {
          this.offlineAnimeDB[anime.mediaId].timeouts = --offlineAnime.timeouts;
          console.log(
            `Timeouts left for ${anime.media.title.romaji} is ${offlineAnime.timeouts}`
          );
          continue;
        }

        const episodesOffline = offlineAnime.episodes;
        const airingEpisodes = anime.media.nextAiringEpisode
          ? anime.media.nextAiringEpisode.episode - 1
          : anime.media.episodes;

        if (airingEpisodes === 0) {
          continue;
        }

        if (
          episodesOffline[episodesOffline.length - 1] !==
          airingEpisodes + offlineAnime.starting_episode
        ) {
          promises.push(anime);
        }
      }
    }

    const tasks = promises.map((anime) =>
      this.limit(() => handleWithDelay.call(this, anime))
    );

    await Promise.all(tasks);
  }
}

export default new Scheduler();
