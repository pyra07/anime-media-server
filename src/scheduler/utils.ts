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
  /* Try to infer the season from the anime title
   *  Example:
   * - Case 1 : Boku no Hero Academia             --> Season 1
   * - Case 2 : Boku no Hero Academia 4           --> Season 4
   * - Case 3 : Boku no Hero Academia S4          --> Season 4
   * - Case 4 : Boku no Hero Academia Season 4    --> Season 4
   * - Case 5 : Boku no Hero Academia Season IV    --> Season 4
   * - Case 5 : Boku no Hero Academia 4th Season  --> Season 4
   */

  // Case 2
  const regex2 = /^(.*) (\d+)$/;

  // TODO : Unimplemented
  return 0;
}

export { joinArr };
