import { exit } from "process";
import Anilist from "./src/Anilist/anilist";
import DB from "./src/database/db";
import Scheduler from "./src/Scheduler/schedule";
import data from "./users.json";
import cron from "cron";
import qbit from "./src/qBitTorrent/qbit";
import nyaa from "./src/Nyaa/nyaa";

(async () => {
  
  const CronJob = cron.CronJob;
  const job = new CronJob(
    "*/20 * * * * *",
    async () => {
       await Scheduler.check();
    },
    null,
    true,
    "Europe/London"
  );
  
})();
