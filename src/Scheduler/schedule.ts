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
  private hook: Webhook;
  constructor() {
    this.hook = new Webhook(webhook);
  }

  private getDifferences(animeList: AniQuery[], fireDBList: any[]) {
    // Go through both lists. If key mediaId does not exist in firedblist, add it to animeList
    // If key mediaId does exist in firedblist, check if the value is different. If it is different, add it to animeList
    const differences: AniQuery[] = [];
    animeList.forEach((anime) => {
      const fireDBAnime = fireDBList.find(
        (item) => item.mediaId === anime.mediaId
      );
      if (!fireDBAnime) {
        differences.push(anime);
      }
    });
    return differences;
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
        log("Checking", new Date().toLocaleTimeString());
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
      await new Promise((resolve) => setTimeout(resolve, 500));
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

  private async handleAnime(
    animeDb: AniQuery[],
    fireDBData: firebase.firestore.DocumentData[]
  ) {
    // Check if user has added new anime. If so, add it to firebase
    const listDifferences = this.getDifferences(animeDb, fireDBData);
    log(`${listDifferences.length} new anime added`);

    if (listDifferences.length > 0) {
      await DB.addToDb(...listDifferences);
      fireDBData.push(...listDifferences);
    }

    // Go thru each anime in animeDb
    for (let index = 0; index < animeDb.length; index++) {
      const anime = animeDb[index];
      const fireDBAnime = fireDBData.find(
        (item) => item.mediaId === anime.mediaId
      );

      if (!fireDBAnime) continue;

      /* This is manually defined in the db by the user.
        Some animes usually have a 2nd season, but instead of starting from episode 1, they start from
        where they left off in season 1., e.g episode 13 */
      const startingEpisode = fireDBAnime.media.startingEpisode
        ? fireDBAnime.media.startingEpisode
        : 0;

      /* Sometimes the title found in nyaa.si is the shortform of the title.
         manually defined in the db by the user. */
      anime.media.title.romaji = fireDBAnime.media.alternativeTitle
        ? fireDBAnime.media.alternativeTitle
        : anime.media.title.romaji;

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

      if (isUpToDate) continue;

      const torrents = await Nyaa.getTorrents(
        anime,
        startEpisode,
        endEpisode,
        fsDownloadedEpisodes
      );
      if (torrents === null) continue;
      if (Array.isArray(torrents))
        await this.downloadTorrents(anime, false, ...torrents);
      else await this.downloadTorrents(anime, true, torrents);
    }
  }

  public async check() {
    const animeDb: AniQuery[] = await Anilist.getAnimeUserList();
    const fireDb = await DB.getAnimeEntries(
      ...animeDb.map((anime) => anime.mediaId.toString())
    );
    // check if animeDb is empty

    if (animeDb.length === 0) return;
    if (fireDb.length === 0) log("No fb data maybe log in?");
    else await this.handleAnime(animeDb, fireDb);
  }
}

export default new Scheduler();
