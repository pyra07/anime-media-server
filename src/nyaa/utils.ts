import { AiringSchedule, Resolution, SearchMode } from "@utils/index";
import { BestMatch, findBestMatch } from "string-similarity";
import anitomy from "anitomy-js";
import anilist from "@ani/anilist";

const pageNumberLimit: number = 5;

/**
 * Calculates the page number given an episode number
 * @param  {number} episode - Episode number
 * @returns {number} The page number
 */
function getPageNumber(episode: number): number {
  return Math.ceil(episode / pageNumberLimit);
}

/**
 * Generate the episode range required, and exclude the episodes that have already been downloaded
 * @param  {number} start - Starting episode
 * @param  {number} end - Ending episode
 * @param  {number[]} inBetween - List of episodes that have already been downloaded to be excluded
 * @returns {number[]}
 */
function getNumbers(start: number, end: number, inBetween: number[]): number[] {
  let numbers = [];
  for (let i = start + 1; i <= end; i++) {
    if (inBetween.indexOf(i) === -1) numbers.push(i);
  }
  return numbers;
}

async function getEpisodeAirDates(mediaId: number, episodeList: number[]) {
  let schedules: AiringSchedule = { nodes: [] };
  const startPage = getPageNumber(episodeList[0]);
  const endPage = getPageNumber(episodeList[episodeList.length - 1]);

  for (let i = startPage; i <= endPage; i++) {
    const data = await anilist.getAiringSchedule(i, mediaId);
    if (!data) return null;
    // Sleep to avoid rate limiting
    await new Promise((r) => setTimeout(r, 1000));

    schedules.nodes.push(...data.nodes);
  }

  // If the number of nodes is less than the number of episodes, return null
  // In rare cases, anilist may sometimes have a broken airing schedule
  if (schedules.nodes.length < episodeList.length) return null;

  return schedules;
}

/**
 * Similarity check for episode range for batch torrents
 * @param  {string} paramEpisodeRange List containing the episode range to check
 * @param  {RegExpMatchArray} episodeRange The episode range extracted from nyaa
 * @returns boolean
 */
function verifyEpisodeRange(
  paramEpisodeRange: number[],
  episodeRange: RegExpMatchArray
): boolean {
  // If the file name contains a range of episodes, check if the episode is in the range
  // If so we can assume the torrent is a batch as well.
  const e = episodeRange[0].split(/[-~]/);
  if (parseInt(e[0]) === 1 && parseInt(e[1]) === paramEpisodeRange[1])
    return true; // If the range is similar, return true
  else return false; // If the range is not similar, return false
}

/**
 * Functions similary to findBestMatch from string-similarity, but lowercases the strings before comparing
 * @param  {string} mainString The main string to compare
 * @param  {string[]} targetStrings The strings to compare against
 * @returns BestMatch Details of the strings matched together
 */
function findBestMatchLowerCase(
  mainString: string,
  ...targetStrings: string[]
): BestMatch {
  return findBestMatch(
    mainString.toLowerCase(),
    targetStrings.map((x) => x.toLowerCase())
  );
}

/**
 * Verifies if the query has some degree of similarity to the media to look for, based on the input given.
 * @param  {string} searchQuery The title of the anime to originally verify
 * @param  {anitomy.AnitomyResult} animeParsedData The parsed data of the RSS item title
 * @param  {Resolution} resolution The resolution to verify
 * @param  {SearchMode} searchMode What to expect from the query. This can be in multiple forms
 * @param  {string} nyaaPubDate The date of the torrent uploaded
 * @param  {AiringSchedule} airDates The airing schedule of the anime
 * @param  {number} episodes The episode(s) number to verify, if applicable
 * @returns {boolean} Returns true if the query is similar to the media we want, otherwise returns false
 */
function verifyQuery(
  searchQuery: string,
  animeParsedData: anitomy.AnitomyResult,
  resolution: Resolution,
  searchMode: SearchMode,
  nyaaPubDate: string,
  airDates: AiringSchedule,
  ...episodes: number[]
): number {
  if (animeParsedData.subtitles?.includes("Dub")) return 0;

  const fileName = animeParsedData.file_name;
  const parsedTitle = animeParsedData.anime_title;

  const parsedResolution =
    resolution === Resolution.NONE
      ? Resolution.NONE
      : animeParsedData.video_resolution;

  if (!parsedTitle || !parsedResolution) return 0; // Guard against empty parsed data

  // If parsedTitle has a title in round brackets, extract it. If found, extract the title out of the brackets
  const subAnimeTitle = parsedTitle.match(/(?<=\().+?(?=\))/);
  const subAnimeTitleString = subAnimeTitle ? subAnimeTitle[0] : "";
  const mainAnimeTitle = parsedTitle.replace(/\(.+?\)/, "");
  const vBarSplitTitle = parsedTitle.split("|"); // if animeTitle is seperated by a '|', then split this.

  const titleMatch = findBestMatchLowerCase(
    searchQuery,
    parsedTitle,
    mainAnimeTitle,
    subAnimeTitleString,
    ...vBarSplitTitle
  );

  const resolutionMatch =
    parsedResolution === Resolution.NONE ||
    parsedResolution.includes(resolution);

  switch (searchMode) {
    case SearchMode.EPISODE:
      const parsedEpisode = animeParsedData.episode_number;
      if (!parsedEpisode) return 0; // Guard against empty episode

      const episodeMatch = episodes[0] === parseInt(parsedEpisode); // Check if episode is similar

      const pageNumber =
        episodes[0] % pageNumberLimit === 0
          ? 0
          : (episodes[0] % pageNumberLimit) - 1;

      console.log("Page Number: ", pageNumber);
      let airDateMatch =
        airDates.nodes[pageNumber].airingAt < new Date(nyaaPubDate).getTime(); // Check if the episode date is similar

      return (
        +episodeMatch +
        +resolutionMatch +
        +airDateMatch +
        titleMatch.bestMatch.rating
      ); // Return the score

    case SearchMode.BATCH:
      const parsedReleaseInfo = animeParsedData.release_information;
      let batchMatch = parsedReleaseInfo?.includes("Batch"); // Check if it is a batch
      // Assign true to batchMatch if: It is 1 episode or if it is a batch
      if (episodes[episodes.length - 1] === 1 || Number(batchMatch ?? false))
        batchMatch = true;
      else batchMatch = false;

      /* Usually some batches don't explicitly specify that the torrent itself is a
         batch. This can be combated by proving there is no episode number to be parsed
         Therefore we assume this is a batch (to be tested further) */
      // const isEpisode = animeParsedData.episode_number;

      airDateMatch =
        airDates.nodes[airDates.nodes.length - 1].airingAt <
        new Date(nyaaPubDate).getTime(); // Check if the episode date is similar

      const episodeRange = fileName.match(/\d+( *)[-~]( *)\d+/); // Check if the file name contains a range of episodes
      if (episodeRange)
        return (
          +verifyEpisodeRange(episodes, episodeRange) +
          +resolutionMatch +
          +airDateMatch +
          titleMatch.bestMatch.rating
        ); // If so, check if the episode is in the range

      return (
        +batchMatch +
        +resolutionMatch +
        +airDateMatch +
        titleMatch.bestMatch.rating
      ); // If not, check if it is a batch

    default:
      return 0;
  }
}

export { getNumbers, verifyEpisodeRange, verifyQuery, getEpisodeAirDates };
