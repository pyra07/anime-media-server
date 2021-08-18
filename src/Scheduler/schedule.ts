// Main big boy
import cron from "cron";
import Anilist from "../Anilist/anilist";
import DB from "../database/db";
import Nyaa from "../Nyaa/nyaa";
import firebase from "firebase";

class Scheduler {
  constructor() {}

  public init() {
    const CronJob = cron.CronJob;

    // Make a job based on UK timing
    const job = new CronJob(
      "*/5 * * * * *",
      this.check,
      null,
      true,
      "Europe/London"
    );
    // Start the job
    job.start();
  }

  private async check() {
    const animeDb = await Anilist.getAnimeUserList();
    const fireDB = await DB.getFromDb();
    const fireDBData = fireDB.docs.map((doc) => doc.data());
  }

  private async getDifferences(animeList: any[], fireDBList: any[]) {
    // Check if media id exists on fireDBList
    

  }
}

export default new Scheduler();
