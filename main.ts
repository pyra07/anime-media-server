import Scheduler from "./src/Scheduler/schedule";

(async () => {
  await Scheduler.run("0 */45 * * * *");
})();