import Scheduler from "./src/Scheduler/schedule";
import cron from "cron";
import db from "./src/database/db";

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
