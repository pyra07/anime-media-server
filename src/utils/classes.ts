import { interval } from "profile.json";

class OfflineAnime {
  episodes: Array<number>;
  starting_episode: number = 0;
  timeouts: number = 0;
  maxTimeouts: number = 0;

  constructor(episodes: Array<number>) {
    this.episodes = episodes;
  }
  /**
   * Sets a timeout until the next episode is aired.
   * @param  {number} time - The time in seconds until the next episode is aired.
   */
  public setTimeoutUntil(time: number): void {
    const timeInMinutes = time / 60;
    this.timeouts = Math.round(timeInMinutes / interval);
  }

  public setTimeout() {
    if (this.maxTimeouts === 10) this.maxTimeouts = 0;
    this.maxTimeouts += 2;
    this.timeouts = this.maxTimeouts;
  }
  public resetTimeout() {
    this.timeouts = 0;
    this.maxTimeouts = 0;
  }
}

export { OfflineAnime };
