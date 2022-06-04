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
  
export { joinArr };