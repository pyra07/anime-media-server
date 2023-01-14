import cron from "cron";
import Anilist from "@ani/anilist";
import DB from "@db/db";
import Nyaa from "@nyaa/nyaa";
import qbit from "@qbit/qbit";
import { joinArr } from "@scheduler/utils";
import { AnimeTorrent, AniQuery, OfflineAnime, OfflineDB } from "@utils/index";
import { MessageBuilder, Webhook } from "discord-webhook-node";
import { webhook } from "profile.json";
import { arrayUnion } from "firebase/firestore";

class Scheduler {
  private hook: Webhook; // Store discord webhook info
  private offlineAnimeDB: OfflineDB;
  constructor() {
    this.hook = new Webhook(webhook);
    this.offlineAnimeDB = {};
  }

  /**
   * Runs the scheduler periodically every x minutes
   * @param  {string} cronTime - Cron time
   * @param  {boolean} clearDB - If true, clears the offlineDB
   * @returns {Promise<void>}
   */
  public async run(cronTime: string, clearDB: boolean): Promise<void> {
    const job = new cron.CronJob(
      cronTime,
      async () => {
        console.log(
          `===============Running scheduler at ${new Date().toLocaleString()}===============`
        ); // log with current time
        await this.check();
      },
      null,
      true,
      "Asia/Muscat"
    );
    if (clearDB)
      new cron.CronJob(
        "0 0 */1 * *",
        () => {
          console.log(`Clearing offlineDB at ${new Date().toLocaleString()}`); // log with current time
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
      // If we successfully added the torrent, then add it to the database later
      if (isAdded)
        if (isBatch)
          downloadedEpisodes.push(
            ...Array.from({ length: anime.media.episodes }, (_, i) => i + 1)
          );
        else if (torrent.episode)
          downloadedEpisodes.push(parseInt(torrent.episode));
    }

    // Append to offlineDB, and remove the timeout
    this.offlineAnimeDB[anime.mediaId].episodes = downloadedEpisodes;
    this.offlineAnimeDB[anime.mediaId].resetTimeout();

    // Inform the user via discord
    this.hook.send(
      new MessageBuilder()
        .setTimestamp()
        .setTitle(
          `**${anime.media.title.romaji} - ${joinArr(
            downloadedEpisodes
          )}** is downloading!`
        )
        .setColor(0x0997e3)
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
    console.log(`Handling ${anime.media.title.romaji}`);
    let fireDBAnime;

    try {
      const fireDBEntry = await DB.getByMediaId(`${anime.mediaId}`);

      if (!fireDBEntry) {
        DB.addToDb(anime);
        fireDBAnime = anime;
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
      this.offlineAnimeDB[anime.mediaId].episodes = fsDownloadedEpisodes;

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
    const animeDb: AniQuery[] = await Anilist.getAnimeUserList();

    if (animeDb.length === 0) return; // check if animeDb is empty

    let promiseArr: Promise<void>[] = [];

    animeDb.map((anime) => {
      if (!this.offlineAnimeDB.hasOwnProperty(anime.mediaId)) {
        this.offlineAnimeDB[anime.mediaId] = new OfflineAnime([]);
        promiseArr.push(this.handleAnime(anime));
      } else {
        const tempOfflineAnime = this.offlineAnimeDB[anime.mediaId];
        const timeout = tempOfflineAnime.timeouts;

        // If the timeout is not expired, then we can skip checking this
        if (!!timeout) {
          console.log(
            `${tempOfflineAnime.timeouts} timeout(s) remain for ${anime.media.title.romaji}`
          );
          tempOfflineAnime.timeouts--;
          this.offlineAnimeDB[anime.mediaId] = tempOfflineAnime;
          return;
        }
        const episodesOffline = tempOfflineAnime.episodes;
        const airingEpisodes = anime.media.nextAiringEpisode
          ? anime.media.nextAiringEpisode.episode - 1
          : anime.media.episodes;
        // Don't handle if the anime hasn't aired yet
        if (airingEpisodes === 0) return;
        // Handle if it needs more downloading
        if (
          episodesOffline[episodesOffline.length - 1] !==
          airingEpisodes + tempOfflineAnime.starting_episode
        )
          promiseArr.push(this.handleAnime(anime));
      }
    });

    await Promise.all(promiseArr);
  }
}

export default new Scheduler();
