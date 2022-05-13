import cron from "cron";
import Anilist from "../Anilist/anilist";
import DB from "../database/db";
import Nyaa from "../Nyaa/nyaa";
import firebase from "firebase";
import qbit from "../qBitTorrent/qbit";
import { AnimeTorrent, AniQuery, AniTitle } from "../utils/types";
import { MessageBuilder, Webhook } from "discord-webhook-node";
import { webhook } from "../../profile.json";
import { log } from "console";

class Scheduler {
  private hook: Webhook; // Store discord webhook info
  constructor() {
    this.hook = new Webhook(webhook);
  }

  /**
   * Runs the scheduler periodically every x minutes
   */
  public async run(cronTime: string): Promise<void> {
    const CronJob = cron.CronJob;
    const job = new CronJob(
      cronTime,
      async () => {
        // log with current time
        log(`Running scheduler at ${new Date().toLocaleString()}`);
        await this.check();
      },
      null,
      true,
      "Europe/London"
    );
  }

  /**
   * Downloads the torrents, and updates the database
   * @param  {AniQuery} anime
   * @param  {boolean} isBatch
   * @param  {AnimeTorrent[]} ...animeTorrent
   * @returns Promise
   */
  private async downloadTorrents(
    anime: AniQuery,
    isBatch: boolean,
    ...animeTorrent: AnimeTorrent[]
  ): Promise<void> {
    const downloadedEpisodes = new Array<number>();
    for (const torrent of animeTorrent) {
      log(
        `Downloading ${torrent.title} - EPISODE ${torrent.episode} @ ${torrent.link}`
      );
      // Download torrent
      var isAdded: boolean = await qbit.addTorrent(
        torrent.link,
        anime.media.title.romaji,
        torrent.episode
      );
      if (isAdded)
        isBatch || !torrent.episode
          ? downloadedEpisodes.push(
              ...Array.from({ length: anime.media.episodes }, (_, i) => i + 1)
            )
          : downloadedEpisodes.push(parseInt(torrent.episode));
    }

    this.hook.send(
      new MessageBuilder()
        .setTimestamp()
        .setTitle(`**${anime.media.title.romaji}** is downloading!`)
        .setColor(0x0997e3)
        .addField("Episode(s)", this.joinArr(downloadedEpisodes), true)
        .addField("Seeders", animeTorrent[0]["nyaa:seeders"], true)
        .addField("Title", animeTorrent[0].title, true)
        .setImage(anime.media.coverImage.extraLarge)
    );

    await DB.modifyAnimeEntry(anime.mediaId.toString(), {
      "media.nextAiringEpisode": anime.media.nextAiringEpisode,
      "media.status": anime.media.status,
      downloadedEpisodes: firebase.firestore.FieldValue.arrayUnion(
        ...downloadedEpisodes
      ),
    });
  }

  private joinArr(array: any[]) {
    if (array.length === 1) {
      return array[0];
    }
    return `${array[0]} - ${array[array.length - 1]}`;
  }

  /**
   * Handles the anime, and downloads the necessary torrents
   * @param  {AniQuery} anime
   * @returns Promise
   */
  private async handleAnime(anime: AniQuery): Promise<void> {
    let fireDBAnime;

    try {
      const fireDBEntry = await DB.getByMediaId(`${anime.mediaId}`);

      if (!fireDBEntry.exists) {
        DB.addToDb(anime);
        fireDBAnime = anime;
      } else fireDBAnime = fireDBEntry.data();
    } catch (error) {
      console.error(error);
      return;
    }

    if (!fireDBAnime) return; // Guard against null fireDBAnime (in case of error)

    /* This is manually defined in the db by the user.
    Some animes usually have a 2nd season, but instead of starting from episode 1, they start from
    where they left off in season 1., e.g episode 13 
    Apparently, there is a workaround for this... */
    const startingEpisode = fireDBAnime.media.startingEpisode
      ? fireDBAnime.media.startingEpisode
      : 0;

    /* Sometimes the title found in nyaa.si is different.
    Therefore, we manually define an alt title if applicable. */
    anime.media.title.romaji =
      fireDBAnime.media.alternativeTitle ?? anime.media.title.romaji;

    const startEpisode = anime.progress + startingEpisode; // Users progress

    // NextAiringEpisode can be null if the anime is finished. So check for that
    const endEpisode = anime.media.nextAiringEpisode
      ? anime.media.nextAiringEpisode.episode - 1 + startingEpisode
      : anime.media.episodes;

    // firestore (fs) downloaded episodes.
    const fsDownloadedEpisodes: any[] = fireDBAnime.downloadedEpisodes || [];

    /* If progress is up to date, then skip
    Or if the user has downloaded all episodes, then skip */
    const isUpToDate =
      startEpisode === endEpisode || // You are up to date
      anime.progress >= endEpisode || // You are also up to date
      anime.progress === anime.media.episodes || // You have watched all episodes
      fsDownloadedEpisodes.length === anime.progress || // The downloaded episodes are up to date
      fsDownloadedEpisodes.length === endEpisode - startEpisode || // you are up to date (but not all episodes need to be downloaded)
      fsDownloadedEpisodes.length === anime.media.episodes; // You have downloaded all episodes

    if (isUpToDate) return;

    log(`Finding ${anime.media.title.romaji}`);
    log(`Starting episode: ${startEpisode}`);
    log(`Ending episode: ${endEpisode}`);

    // Attempt to find the anime.
    const isSuccessful = await this.getTorrents(
      anime,
      startEpisode,
      endEpisode,
      fsDownloadedEpisodes
    );

    if (isSuccessful) return; // Finish the function if successful

    // For new entries, sometimes you need to use a different title.
    if (
      !fireDBAnime.media.alternativeTitle &&
      fsDownloadedEpisodes.length === 0
    ) {
      // Loop over synonyms and find the one that matches a nyaa hit
      const synonyms = anime.media.synonyms;
      for (const synonym of synonyms) {
        // If synonym is not in English, skip
        // TODO
        anime.media.title.romaji = synonym;
        const isValidTitle = await this.getTorrents(
          anime,
          startEpisode,
          endEpisode,
          fsDownloadedEpisodes
        );
        /* If we found a valid title, then we can stop looping.
           Add the title to firebase */
        if (isValidTitle) {
          DB.modifyAnimeEntry(anime.mediaId.toString(), {
            "media.alternativeTitle": synonym,
          });
          break;
        }
      }
    }
  }

  private async getTorrents(
    anime: AniQuery,
    start: number,
    end: number,
    fsDownloadedEpisodes: any[]
  ): Promise<boolean> {
    const torrents = await Nyaa.getTorrents(
      anime,
      start,
      end,
      fsDownloadedEpisodes
    );

    if (torrents === null) return false; // Guard against null torrents (in case of error)

    if (Array.isArray(torrents))
      // Proceed to download them using qbit
      await this.downloadTorrents(anime, false, ...torrents);
    else await this.downloadTorrents(anime, true, torrents);
    return true;
  }

  public async check() {
    const animeDb: AniQuery[] = await Anilist.getAnimeUserList();

    if (animeDb.length === 0) return; // check if animeDb is empty

    await Promise.all(animeDb.map((anime) => this.handleAnime(anime)));
  }
}

export default new Scheduler();
