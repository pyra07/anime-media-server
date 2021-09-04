import anilist from "./src/Anilist/anilist";

(async () => {
  const data = await anilist.getAnimeUserList();
  data.forEach((item) => {
    console.log(item.media.title.romaji);
    if (item.media.nextAiringEpisode)
      console.log(item.media.nextAiringEpisode.episode);
    else console.log("No next episode");
  });
})();
