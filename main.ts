import { exit } from "process";
import Anilist from "./src/Anilist/anilist";
import DB from "./src/database/db";
import Scheduler from "./src/Scheduler/schedule";
import data from "./users.json";
import cron from "cron";
import qbit from "./src/qBitTorrent/qbit";

(async () => {
  
  const CronJob = cron.CronJob;
  const job = new CronJob(
    "* * * * *",
    async () => {
       await Scheduler.check();
    },
    null,
    true,
    "Europe/London"
  );

  
})();
