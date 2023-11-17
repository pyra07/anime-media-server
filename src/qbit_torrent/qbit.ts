import { QBittorrent } from "@ctrl/qbittorrent";
import path from "path/posix";
import { torrent_url, password, username, rootDir } from "profile.json";

class QbitTorrent {
  private client: QBittorrent;

  constructor() {
    this.client = new QBittorrent({
      baseUrl: torrent_url,
      username: username,
      password: password,
    });
  }

  public async addTorrent(
    link: string,
    title: string,
    episodeStr?: string
  ): Promise<boolean> {
    /* *sigh* this is so qbit can download the torrent file, without 
    the need for a VPN. Mirrors FTW */
    link = link.replace("nyaa.si","nyaa.land");
    console.log(link);
    const isLogged = await this.client.login();

    if (!isLogged) return isLogged;
    
    const isAdded = await this.client.addTorrent(link, {
      savepath: path.join(rootDir, title),
      rename: episodeStr ? `${title} - ${episodeStr}` : title,
    });

    return isAdded;
  }
}

export default new QbitTorrent();
