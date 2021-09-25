import db from "./src/database/db";
import schedule from "./src/Scheduler/schedule";

(async () => {

  await db.logIn(); 
  await schedule.check();
  
})();
