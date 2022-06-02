class OfflineAnime {
  episodes: Array<number>;
  timeouts: number = 0;
  maxTimeouts: number = 0;

  constructor(episodes: Array<number>) {
    this.episodes = episodes;
  }

  public setTimeout() {
    if (this.maxTimeouts === 50) this.maxTimeouts = 0;
    this.maxTimeouts += 2;
    this.timeouts = this.maxTimeouts;
  }
}

export { OfflineAnime };
