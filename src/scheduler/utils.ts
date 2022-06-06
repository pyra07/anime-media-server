/**
 * Displays the the range of an array
 * @param  {any[]} array
 * @returns {string} - Range of array
 */
function joinArr(array: any[]) {
  if (array.length === 1) {
    return array[0];
  }
  return `${array[0]} - ${array[array.length - 1]}`;
}
/**
 * @param  {string[]} ...animeEntry
 */
function getAnimeSeason(animeEntry: string): number {
  // Use regex to get the season number 
  // E.g Boku no Hero 4 -> 4
  // E.g Boku no Hero Season 4 -> 4
  // E.g Boku no Hero 4 4th Season -> 4

  const seasonRegex = /(?<=\s|^)(\d+)(?=\s|$)/g;
  return 1;
}

export { joinArr };
