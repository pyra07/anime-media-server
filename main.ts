import Anilist from "./src/Anilist/anilist";
import fs from "fs";

(async () => {
  let ani = new Anilist();
  await ani.getAnimeUserList("387521");
  
})();
