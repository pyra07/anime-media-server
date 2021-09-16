import cron from "cron";
import Anilist from "../Anilist/anilist";
import DB from "../database/db";
import Nyaa from "../Nyaa/nyaa";
import firebase from "firebase";
import qbit from "../qBitTorrent/qbit";
import { AniQuery } from "../utils/types";
import {MessageBuilder, Webhook} from "discord-webhook-node";
import {webhook} from "../../profile.json"

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
   * Runs the scheduler periodically every 30 minutes
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

      // If progress is up to date, then skip
      if (startEpisode === endEpisode) continue;

      // Firestore downloaded episodes
      const fsDownloadedEpisodes = fireDBAnime.downloadedEpisodes || [];

      const torrents = await Nyaa.getTorrents(
        anime,
        startEpisode,
        endEpisode,
        fsDownloadedEpisodes
      );

      // Check if torrents are empty
      if (Array.isArray(torrents)) {
        if (torrents.length === 0) continue;
        for (let index = 0; index < torrents.length; index++) {
          const torrent = torrents[index];
          console.log("Downloading", torrent.title, torrent.link);
          // Send a webhook to Discord
        await this.hook.send(new MessageBuilder()
        .setTimestamp()
        .setTitle(`**${anime.media.title.romaji}**`)
        .setColor(0x0997e3)
        .setDescription(`Currently downloading episode ${torrent.episode}`)
        .setImage(anime.media.coverImage.extraLarge)
        )
          await qbit.addTorrent(torrent.link, anime.media.title.romaji);
          // Wait for 500ms to prevent qbit from crashing
          await new Promise((resolve) => setTimeout(resolve, 500));
        }

        fsDownloadedEpisodes.push(
          ...torrents.map((torrent) => parseInt(torrent.episode))
        );

        

        await DB.updateProgress(
          anime.mediaId.toString(),
          parseInt(torrents[torrents.length - 1].episode),
          anime.media,
          fsDownloadedEpisodes
        );
      } else {
        if (Object.keys(torrents).length === 0) continue;
        console.log("Downloading Batch", torrents.title, torrents.link);
        await qbit.addTorrent(torrents.link, anime.media.title.romaji);
        // Generate array of numbers between start and end
        const episodeArray = Array.from(
          { length: endEpisode - startEpisode },
          (v, k) => k + startEpisode + 1
        );
        await DB.updateProgress(
          anime.mediaId.toString(),
          0,
          anime.media,
          episodeArray
        );
        

        

      }
    }
  }

  public async check() {
    const animeDb: AniQuery[] = await Anilist.getAnimeUserList();
    const fireDB = await DB.getFromDb();

    if (fireDB.docs.length === 0) {
      console.log("No firebase data found. Creating new one");
      await DB.addToDb(animeDb);
      await this.handleAnime(animeDb);
    } else {
      const fireDBData = fireDB.docs.map((doc) => doc.data()); // convert to array
      await this.handleAnime(animeDb, fireDBData);
    }
  }
}

export default new Scheduler();
