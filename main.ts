import { exit } from "process";
import Anilist from "./src/Anilist/anilist";
import DB from "./src/database/db";
import Scheduler from "./src/Scheduler/schedule";
import data from "./users.json";
import cron from "cron";

(async () => {
  
  const CronJob = cron.CronJob;
  const job = new CronJob(
    "*/10 * * * * *",
    () => {
       Scheduler.check();
    },
    null,
    true,
    "Europe/London"
  );
})();
