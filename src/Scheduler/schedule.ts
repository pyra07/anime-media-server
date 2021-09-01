// Main big boy
import cron from "cron";
import Anilist from "../Anilist/anilist";
import DB from "../database/db";
import Nyaa from "../Nyaa/nyaa";
import firebase from "firebase";
import qbit from "../qBitTorrent/qbit";

class Scheduler {
  constructor() {}

  private getDifferences(animeList: any[], fireDBList: any[]) {
    // Go through both lists. If key mediaId does not exist in firedblist, add it to animeList
    // If key mediaId does exist in firedblist, check if the value is different. If it is different, add it to animeList

    var animeListCopy = animeList.slice(0);
    var fireDBListCopy = fireDBList.slice(0);
    for (var i = 0; i < fireDBListCopy.length; i++) {
      var fireDBItem = fireDBListCopy[i];
      var animeItem = animeListCopy.find(
        (item) => item.mediaId === fireDBItem.mediaId
      );
      if (animeItem) {
        if (animeItem.status !== fireDBItem.status) {
          animeListCopy.push(fireDBItem);
        }
        animeListCopy.splice(animeListCopy.indexOf(animeItem), 1);
      } else {
        animeListCopy.push(fireDBItem);
      }
    }
    return animeListCopy;
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

  /**
   * Checks for new animes, new episodes, and downloads them. wow
   */
  public async check() {
    const animeDb = await Anilist.getAnimeUserList();
    let fireDB = await DB.getFromDb();

    if (!fireDB) {
      console.log("No firebase data found. Creating new one");
      await DB.addToDb(animeDb);
      fireDB = await DB.getFromDb();
    }

    const fireDBData = fireDB.docs.map((doc) => doc.data()); // convert to array

    // If the user add a new anime, add it to the firebase database
    const listDifferences = this.getDifferences(animeDb, fireDBData);
    if (listDifferences) await DB.addToDb(listDifferences);
    fireDBData.push(...listDifferences);

    // Loops through anime list
    for (let index = 0; index < animeDb.length; index++) {
      const anime = animeDb[index];
      const fireDBAnime = fireDBData.find(
        (item) => item.mediaId === anime.mediaId
      );
      if (!fireDBAnime) continue;

      // Takes whichever user progress is the latest
      const startEpisode = anime.progress;
      // anime.progress > fireDBAnime.progress
      //   ? anime.progress
      //   : fireDBAnime.progress;

      // NextAiringEpisode can be null if the anime is finished. So check for that
      const endEpisode = anime.media.nextAiringEpisode
        ? anime.media.nextAiringEpisode.episode - 1
        : anime.media.episodes;

      const fsDownloadedEpisodes: number[] =
        fireDBAnime.downloadedEpisodes || [];

      if (startEpisode === endEpisode) continue;

      const downloadList = await Nyaa.getTorrents(
        [anime],
        startEpisode,
        endEpisode,
        fsDownloadedEpisodes
      );

      if (downloadList.length > 0) {
        downloadList.forEach((torrent) => {
          console.log(
            "Downloading :",
            torrent.title,
            torrent.link,
            torrent.episode
          );
        });

        // Individually download each episode
        let epDownloadedList: number[] = [];
        try {
          for (let i = 0; i < downloadList.length; i++) {
            const torrent = downloadList[i];
            const isAdded = await qbit.addTorrent(
              torrent.link,
              torrent.title
            );
            if (isAdded) epDownloadedList.push(parseInt(torrent.episode));
            // Wait for 1 second. Avoids torrents not being added
            await new Promise((resolve) => setTimeout(resolve, 1000));
          }
          epDownloadedList.push(...fsDownloadedEpisodes);
          await DB.updateProgress(
            anime.mediaId.toString(),
            parseInt(downloadList[downloadList.length - 1].episode),
            anime.media,
            epDownloadedList
          );
        } catch (error) {
          console.log(error);
        }
      }
    }
  }
}

export default new Scheduler();
