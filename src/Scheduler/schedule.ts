// Main big boy
import cron from "cron";
import Anilist from "../Anilist/anilist";
import DB from "../database/db";
import Nyaa from "../Nyaa/nyaa";
import firebase from "firebase";
import qbit from "../qBitTorrent/qbit";
import { AniQuery } from "../utils/types";

class Scheduler {
  constructor() {}

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
        await this.check2();
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

  public async check2() {
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

  /**
   * Checks for new animes, new episodes, and downloads them. wow
   */
  // public async check() {
  //   const animeDb: AniQuery[] = await Anilist.getAnimeUserList();
  //   let fireDB = await DB.getFromDb();

  //   if (!fireDB) {
  //     console.log("No firebase data found. Creating new one");
  //     await DB.addToDb(animeDb);
  //     fireDB = await DB.getFromDb();
  //   }

  //   const fireDBData = fireDB.docs.map((doc) => doc.data()); // convert to array
  //   // If the user add a new anime, add it to the firebase database
  //   const listDifferences = this.getDifferences(animeDb, fireDBData);
  //   if (listDifferences) await DB.addToDb(listDifferences);
  //   fireDBData.push(...listDifferences);

  //   // Loops through anime list
  //   for (let index = 0; index < animeDb.length; index++) {
  //     const anime = animeDb[index];
  //     const fireDBAnime = fireDBData.find(
  //       (item) => item.mediaId === anime.mediaId
  //     );
  //     if (!fireDBAnime) continue;

  //     // Takes whichever user progress is the latest
  //     const startEpisode = anime.progress;
  //     // anime.progress > fireDBAnime.progress
  //     //   ? anime.progress
  //     //   : fireDBAnime.progress;

  //     // NextAiringEpisode can be null if the anime is finished. So check for that
  //     const endEpisode = anime.media.nextAiringEpisode
  //       ? anime.media.nextAiringEpisode.episode - 1
  //       : anime.media.episodes;

  //     const fsDownloadedEpisodes: number[] =
  //       fireDBAnime.downloadedEpisodes || [];

  //     if (startEpisode === endEpisode) continue;

  //     const downloadList = await Nyaa.getTorrents(
  //       anime,
  //       startEpisode,
  //       endEpisode,
  //       fsDownloadedEpisodes
  //     );

  //     if (downloadList.length > 0) {
  //       downloadList.forEach((torrent) => {
  //         console.log(
  //           "Downloading :",
  //           torrent.title,
  //           torrent.link,
  //           torrent.episode
  //         );
  //       });

  //       // Individually download each episode
  //       let epDownloadedList: number[] = [];
  //       try {
  //         for (let i = 0; i < downloadList.length; i++) {
  //           const torrent = downloadList[i];
  //           const isAdded = await qbit.addTorrent(
  //             torrent.link,
  //             anime.media.title.romaji
  //           );
  //           if (isAdded) epDownloadedList.push(parseInt(torrent.episode));
  //           // Wait for 1 second. Avoids torrents not being added
  //           await new Promise((resolve) => setTimeout(resolve, 1000));
  //         }
  //         epDownloadedList.push(...fsDownloadedEpisodes);
  //         await DB.updateProgress(
  //           anime.mediaId.toString(),
  //           parseInt(downloadList[downloadList.length - 1].episode),
  //           anime.media,
  //           epDownloadedList
  //         );
  //       } catch (error) {
  //         console.log(error);
  //       }
  //     }
  //   }
  // }
}

export default new Scheduler();
