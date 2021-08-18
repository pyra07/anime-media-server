import { exit } from "process";
import Anilist from "./src/Anilist/anilist";
import DB from "./src/database/db";
import Scheduler from "./src/Scheduler/schedule";
import data from "./users.json";

(async () => {
   Scheduler.init();
})();
