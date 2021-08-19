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


  public async check() {
    const animeDb = await Anilist.getAnimeUserList();
    const fireDB = await DB.getFromDb();
    const fireDBData = fireDB.docs.map((doc) => doc.data()); // convert to array

    // If the user add a new anime, add it to the firebase database
    const listDifferences = this.getDifferences(animeDb, fireDBData);
    if (listDifferences) await DB.addToDb(listDifferences);

    for (let index = 0; index < animeDb.length; index++) {
      const anime = animeDb[index];
      const fireDBAnime = fireDBData.find(
        (item) => item.mediaId === anime.mediaId
      );
      if (!fireDBAnime) continue;

      // NextAiringEpisode can be null if the anime is finished. So check for that
      let endEpisode = anime.media.nextAiringEpisode
        ? anime.media.nextAiringEpisode.episode - 1
        : anime.media.episodes;

      const downloadList = await Nyaa.getTorrents(
        [anime],
        fireDBAnime.progress,
        endEpisode
      );

      if (downloadList.length > 0) {
        const names = downloadList.map((item) => item.title);
        const links = downloadList.map((item) => item.link).join("\n");
        console.log(names, '\n', links, '\n\n');
        

        //const isAdded = await qbit.addTorrent(links);
        //if (isAdded) await DB.updateProgress(anime.mediaId, endEpisode);
      }
    }
  }
}

export default new Scheduler();
