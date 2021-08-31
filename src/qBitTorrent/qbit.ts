import { QBittorrent } from "@ctrl/qbittorrent";
import { torrent_url, password, username } from "../../profile.json";

class QbitTorrent {
  private client: QBittorrent;

  constructor() {
    this.client = new QBittorrent({
      baseUrl: torrent_url,
      username: username,
      password: password,
    });
  }

  public async addTorrent(link: string): Promise<boolean> {
    const isAdded = await this.client.addMagnet(link);
    return isAdded;
  }
}

export default new QbitTorrent();
