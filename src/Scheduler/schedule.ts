import cron from "cron";
import Anilist from "../Anilist/anilist";
import DB from "../database/db";
import Nyaa from "../Nyaa/nyaa";
import firebase from "firebase";
import qbit from "../qBitTorrent/qbit";
import { AnimeTorrent, AniQuery, AniTitle } from "../utils/types";
import { MessageBuilder, Webhook } from "discord-webhook-node";
import { webhook } from "../../profile.json";

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
        console.log("Checking", new Date().toLocaleTimeString());
        await this.check();
      },
      null,
      true,
      "Europe/London"
    );
  }

  private async downloadTorrents(
    anime: AniQuery,
    isBatch: boolean,
    ...animeTorrent: AnimeTorrent[]
  ): Promise<void> {
    const downloadedEpisodes = new Array<number>();
    for (const torrent of animeTorrent) {
      await new Promise((resolve) => setTimeout(resolve, 500));
      console.log(`Downloading ${torrent.title} @ ${torrent.link}`);

      // Download torrent
      var isAdded: boolean = await qbit.addTorrent(torrent.link, torrent.title);
      if (isAdded)
        isBatch
          ? downloadedEpisodes.push(
              ...Array.from({ length: anime.media.episodes }, (_, i) => i + 1)
            )
          : downloadedEpisodes.push(parseInt(torrent.episode));
    }

    await this.hook.send(
      new MessageBuilder()
        .setTimestamp()
        .setTitle(`**${anime.media.title.romaji}**`)
        .setColor(0x0997e3)
        .setDescription(
          isBatch
            ? `Currently downloading batch.`
            : downloadedEpisodes.length === 1
            ? `Currently downloading episodes ${downloadedEpisodes[0]}`
            : `Currently downloading episodes ${downloadedEpisodes[0]}-${
                downloadedEpisodes[downloadedEpisodes.length - 1]
              }`
        )
        .setImage(anime.media.coverImage.extraLarge)
    );

    await DB.updateProgress(
      anime.mediaId.toString(),
      anime.media.nextAiringEpisode,
      anime.media.status,
      downloadedEpisodes
    );
  }

  private async handleAnime(
    animeDb: AniQuery[],
    fireDBData?: firebase.firestore.DocumentData[]
  ) {
    // Check if fireDBData is empty
    if (fireDBData === undefined) {
      fireDBData = animeDb as firebase.firestore.DocumentData[];
    }

    // Check if user has added new anime. If so, add it to firebase
    const listDifferences = this.getDifferences(animeDb, fireDBData);
    if (listDifferences.length > 0) await DB.addToDb(listDifferences);
    fireDBData.push(...listDifferences);

    // Go thru each anime
    for (let index = 0; index < animeDb.length; index++) {
      const anime = animeDb[index];
      const fireDBAnime = fireDBData.find(
        (item) => item.mediaId === anime.mediaId
      );

      // Should find fail, just skip.
      if (!fireDBAnime) continue;

      // Users progress
      const startEpisode = anime.progress;

      // NextAiringEpisode can be null if the anime is finished. So check for that
      const endEpisode = anime.media.nextAiringEpisode
        ? anime.media.nextAiringEpisode.episode - 1
        : anime.media.episodes;

      // Firestore downloaded episodes
      const fsDownloadedEpisodes = fireDBAnime.downloadedEpisodes || [];

      // If progress is up to date, then skip
      // Or if the user has downloaded all episodes, then skip
      if (
        startEpisode === endEpisode ||
        fsDownloadedEpisodes.length === endEpisode - startEpisode
      )
        continue;

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
    const fireDB = await DB.getFromDb();
    // check if animeDb is empty

    if (animeDb.length === 0) return;

    if (fireDB.docs.length === 0) {
      console.log("No firebase data found. Creating new one");
      await DB.createUserDB();
      await DB.addToDb(animeDb);
      await this.handleAnime(animeDb);
    } else {
      const fireDBData = fireDB.docs.map((doc) => doc.data()); // convert to array
      await this.handleAnime(animeDb, fireDBData);
    }
  }
}

export default new Scheduler();
