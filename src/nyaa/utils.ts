import { Resolution, SearchMode } from "@utils/index";
import { findBestMatch } from "string-similarity";
import anitomy from "anitomy-js";

/**
 * Gets the numbers between start and end
 * @param  {number} start
 * @param  {number} end
 * @returns {number[]}
 */

function getNumbers(start: number, end: number, inBetween: number[]): number[] {
  let numbers = [];
  for (let i = start + 1; i <= end; i++) {
    if (inBetween.indexOf(i) === -1) numbers.push(i);
  }
  return numbers;
}
/**
 * Similarity check for episode range for batch torrents
 * @param  {string} episode The episode number to verify
 * @param  {RegExpMatchArray} episodeRange
 * @returns boolean
 */
function verifyEpisodeRange(
  paramEpisodeRange: string[],
  episodeRange: RegExpMatchArray
): boolean {
  // If the file name contains a range of episodes, check if the episode is in the range
  // If so we can assume the torrent is a batch as well.
  const e = episodeRange[0].split(/[-~]/);
  if (
    parseInt(e[0]) === parseInt(paramEpisodeRange[0]) &&
    parseInt(e[1]) === parseInt(paramEpisodeRange[1])
  )
    return true; // If the range is similar, return true
  else return false; // If the range is not similar, return false
}

/**
 * Verifies if the query has some degree of similarity to the media to look for, based on the input given.
 * @param  {string} searchQuery The title of the anime to originally verify
 * @param  {anitomy.AnitomyResult} animeParsedData The parsed data of the RSS item title
 * @param  {Resolution} resolution The resolution to verify
 * @param  {SearchMode} searchMode What to expect from the query. This can be in multiple forms
 * @param  {string} episode? The episode number to verify, if applicable
 * @returns {boolean} Returns true if the query is similar to the media we want, otherwise returns false
 */
function verifyQuery(
  searchQuery: string,
  animeParsedData: anitomy.AnitomyResult,
  resolution: Resolution,
  searchMode: SearchMode,
  paramEpisodeRange: string[]
): boolean {
  const fileName = animeParsedData.file_name;
  const parsedTitle = animeParsedData.anime_title;
  const parsedResolution = animeParsedData.video_resolution;

  if (!parsedTitle || !parsedResolution) return false; // Guard against empty parsed data

  // If parsedTitle has a title in round brackets, extract it. If found, extract the title out of the brackets
  const subAnimeTitle = parsedTitle.match(/(?<=\().+?(?=\))/);
  const subAnimeTitleString = subAnimeTitle ? subAnimeTitle[0] : "";
  const mainAnimeTitle = parsedTitle.replace(/\(.+?\)/, "");

  const vBarSplitTitle = parsedTitle.split("|"); // if animeTitle is seperated by a '|', then split this.

  /**Attempt to find best match based on various titles procured
   * Using lowercase to avoid tampering with bestMatch rating (not important)
   */
  const titleMatch = findBestMatch(searchQuery.toLowerCase(), [
    parsedTitle.toLowerCase(),
    mainAnimeTitle.toLowerCase(),
    subAnimeTitleString.toLowerCase(),
    ...vBarSplitTitle.map((x) => x.toLowerCase()),
  ]);

  const resolutionMatch = parsedResolution.includes(resolution);

  // If title is not similar, and resolution is not similar, return false
  if (titleMatch.bestMatch.rating < 0.8) return false;
  if (!resolutionMatch) return false;

  switch (searchMode) {
    case SearchMode.EPISODE:
      const parsedEpisode = animeParsedData.episode_number;
      if (!parsedEpisode) return false; // Guard against empty episode

      const episodeMatch =
        parseInt(paramEpisodeRange[0]) === parseInt(parsedEpisode); // Check if episode is similar

      return episodeMatch; // Return if all conditions are met

    case SearchMode.BATCH:
      const parsedReleaseInfo = animeParsedData.release_information;
      const batchMatch = parsedReleaseInfo?.includes("Batch"); // Check if it is a batch

      /* Usually some batches don't explicitly specify that the torrent itself is a
         batch. This can be combated by proving there is no episode number to be parsed
         Therefore we assume this is a batch (to be tested further) */
      const isEpisode = animeParsedData.episode_number;

      const episodeRange = fileName.match(/\d+( *)[-~]( *)\d+/); // Check if the file name contains a range of episodes
      if (episodeRange)
        return verifyEpisodeRange(paramEpisodeRange, episodeRange); // If so, check if the episode is in the range

      return !!(batchMatch || !isEpisode); // Return if all conditions are met.

    default:
      return false;
  }
}

export { getNumbers, verifyEpisodeRange, verifyQuery };
