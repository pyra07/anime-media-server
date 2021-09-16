import anilist from "./src/Anilist/anilist";
import qbit from "./src/qBitTorrent/qbit";
import schedule from "./src/Scheduler/schedule";

(async () => {
 
  await schedule.check();
  
})();
