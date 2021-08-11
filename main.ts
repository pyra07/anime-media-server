import Anilist from "./src/Anilist/anilist";
import fs from "fs";
import Nyaa from "./src/Nyaa/nyaa";
import d from "./users.json";

(async () => {
  //   let ani = new Anilist();
  //   await ani.getAnimeUserList("387521");
    var g = await new Nyaa().getRSS("Kobayashi-san Chi no Maid Dragon S", "01", "1080");
    console.log(g);
//   await downloadTest();
})();

// Return a list of numbers between two given numbers
// (inclusive)
function getNumbers(start: number, end: number) {
  let numbers = [];
  for (let i = start + 1; i < end; i++) {
    numbers.push(i);
  }
  return numbers;
}

async function downloadTest() {
  let ani = new Anilist();
  let nyaa = new Nyaa();

  let da = await ani.getAnimeUserList("387521");
  // write da to user.json
  fs.writeFileSync("./users.json", JSON.stringify(da, null, 2));

  let t = d.data.MediaListCollection.lists[0];

  t.entries.forEach(async (e: any) => {
    var progress = e.progress;
    var nextAiringEpisode = e.media.nextAiringEpisode?.episode;
    if (nextAiringEpisode) {
      var episodeList = getNumbers(progress, nextAiringEpisode);
      episodeList.forEach(async (episode) => {
        console.log(`Downloading ${e.media.title.romaji} - ${episode}`);
        var meow = await nyaa.getRSS(
          e.media.title.romaji,
          episode.toString(),
          "1080"
        );
        // if meow is null
        if (meow == null) {
          meow = await nyaa.getRSS(
            e.media.title.english,
            episode.toString(),
            "1080"
          );
        }
        console.log(meow);
      });
    }
  });
}
