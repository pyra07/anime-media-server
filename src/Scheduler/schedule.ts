import cron from "cron";
import Anilist from "../Anilist/anilist";
import DB from "../database/db";
import Nyaa from "../Nyaa/nyaa";
import firebase from "firebase";
import qbit from "../qBitTorrent/qbit";
import { AnimeTorrent, AniQuery, AniTitle } from "../utils/types";
import { MessageBuilder, Webhook } from "discord-webhook-node";
import { webhook } from "../../profile.json";
import { log } from "console";

class Scheduler {
  private hook: Webhook; // Store discord webhook info
  private offlineEpisodeStorage: { [key: string]: Array<number> } = {}; // Store information of offline episodes.
  constructor() {
    this.hook = new Webhook(webhook);
    this.offlineEpisodeStorage = {};
  }

  /**
   * Runs the scheduler periodically every x minutes
   */
  public async run(cronTime: string): Promise<void> {
    const CronJob = cron.CronJob;
    const job = new CronJob(
      cronTime,
      async () => {
        // log with current time
        log(`Running scheduler at ${new Date().toLocaleString()}`);
        await this.check();
      },
      null,
      true,
      "Europe/London"
    );
  }

  /**
   * Downloads the torrents, and updates the database
   * @param  {AniQuery} anime
   * @param  {boolean} isBatch
   * @param  {AnimeTorrent[]} ...animeTorrent
   * @returns Promise
   */
  private async downloadTorrents(
    anime: AniQuery,
    isBatch: boolean,
    ...animeTorrent: AnimeTorrent[]
  ): Promise<void> {
    const downloadedEpisodes = new Array<number>();
    for (const torrent of animeTorrent) {
      log(
        `Downloading ${torrent.title} - EPISODE ${torrent.episode} @ ${torrent.link}`
      );
      // Download torrent
      var isAdded: boolean = await qbit.addTorrent(
        torrent.link,
        anime.media.title.romaji,
        torrent.episode
      );
      if (isAdded)
        isBatch || !torrent.episode
          ? downloadedEpisodes.push(
              ...Array.from({ length: anime.media.episodes }, (_, i) => i + 1)
            )
          : downloadedEpisodes.push(parseInt(torrent.episode));
    }

    this.hook.send(
      new MessageBuilder()
        .setTimestamp()
        .setTitle(`**${anime.media.title.romaji}** is downloading!`)
        .setColor(0x0997e3)
        .addField("Episode(s)", this.joinArr(downloadedEpisodes), true)
        .addField("Seeders", animeTorrent[0]["nyaa:seeders"], true)
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
    try {
      const fireDBEntry = await DB.getByMediaId(`${anime.mediaId}`);

      if (!fireDBEntry.exists) {
        DB.addToDb(anime);
        var fireDBAnime: any = anime;
      } else var fireDBAnime: any = fireDBEntry.data();
    } catch (error) {
      console.log(error);
      return;
    }

    /* This is manually defined in the db by the user.
          Some animes usually have a 2nd season, but instead of starting from episode 1, they start from
          where they left off in season 1., e.g episode 13 */
    const startingEpisode = fireDBAnime.media.startingEpisode
      ? fireDBAnime.media.startingEpisode
      : 0;

    /* Sometimes the title found in nyaa.si is the shortform of the title.
           manually defined in the db by the user. */
    anime.media.title.romaji =
      fireDBAnime.media.alternativeTitle ?? anime.media.title.romaji;

    // Users progress
    const startEpisode = anime.progress + startingEpisode;

    // NextAiringEpisode can be null if the anime is finished. So check for that
    const endEpisode = anime.media.nextAiringEpisode
      ? anime.media.nextAiringEpisode.episode - 1 + startingEpisode
      : anime.media.episodes;

    // Firestore downloaded episodes
    const fsDownloadedEpisodes: any[] = fireDBAnime.downloadedEpisodes || [];

    // If progress is up to date, then skip
    // Or if the user has downloaded all episodes, then skip
    const isUpToDate =
      startEpisode === endEpisode ||
      anime.progress >= endEpisode ||
      anime.progress === anime.media.episodes ||
      fsDownloadedEpisodes.length === anime.media.episodes;

    if (isUpToDate) return; // Skip

    // First, find the anime with base settings.
    const isSuccessful = await this.getTorrents(
      anime,
      startEpisode,
      endEpisode,
      fsDownloadedEpisodes
    );

    if (isSuccessful) return; // Finish the function if successful

    // This is probably a new anime, so first we determine which altTitle to use
    if (
      !fireDBAnime.media.alternativeTitle &&
      fsDownloadedEpisodes.length === 0
    ) {
      // Loop over synonyms and find the one that matches a nyaa hit
      const synonyms = anime.media.synonyms;
      for (const synonym of synonyms) {
        // If synonym is not in English, skip
        // TODO
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
    if (torrents === null) return false;
    if (Array.isArray(torrents))
      await this.downloadTorrents(anime, false, ...torrents);
    else await this.downloadTorrents(anime, true, torrents);
    return true;
  }

  private assertEpisodesDownloaded(
    epList: Array<number>,
    endEpisode: number
  ): boolean {
    for (const ep of epList) {
      if (ep > endEpisode) return false;
    }
    return true;
  }

  public async check() {
    const animeDb: AniQuery[] = await Anilist.getAnimeUserList();

    if (animeDb.length === 0) return; // check if animeDb is empty

    /* Check if any new episodes need downloading, according to the offline db
     If it is, then download the torrents */
    for (const anime of animeDb) {
      const offlineEpisodeList: Array<number> =
        this.offlineEpisodeStorage[anime.mediaId.toString()] || [];
      const nextAiringEpisode =
        anime.media.nextAiringEpisode?.episode || anime.media.episodes;
      if (
        offlineEpisodeList.length === 0 ||
        this.assertEpisodesDownloaded(offlineEpisodeList, nextAiringEpisode)
      )
        this.handleAnime(anime);
    }
  }
}

export default new Scheduler();
