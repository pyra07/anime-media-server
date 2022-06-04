/**
 * Gets the numbers between start and end
 * @param  {number} start
 * @param  {number} end
 * @returns {number[]}
 */

export function getNumbers(start: number, inBetween: number[], end: number): number[] {
  let numbers = [];
  for (let i = start + 1; i <= end; i++) {
    if (inBetween.indexOf(i) === -1) numbers.push(i);
  }
  return numbers;
}


