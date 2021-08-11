import Anilist from "./src/Anilist/anilist";
import fs from "fs";
import Nyaa from "./src/Nyaa/nyaa";

(async () => {
  //   let ani = new Anilist();
  //   await ani.getAnimeUserList("387521");
  var meow = await new Nyaa().getRSS("One Piece","921", "1080p");
  console.log(meow);
})();
