import { QBittorrent } from "@ctrl/qbittorrent";
import { torrent_url, password, username, rootDir } from "../../profile.json";

class QbitTorrent {
  private client: QBittorrent;

  constructor() {
    this.client = new QBittorrent({
      baseUrl: torrent_url,
      username: username,
      password: password,
    });
  }

  public async addTorrent(link: string, title: string): Promise<boolean> {
    await this.client.login();
    const isAdded = await this.client.addMagnet(link, {
      savepath: `${rootDir}/${title}/`,
    });
    return isAdded;
  }
}

export default new QbitTorrent();
