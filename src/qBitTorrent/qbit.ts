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

  public async addTorrent(links: string): Promise<boolean> {
    const result = await this.client.addMagnet(links);
    return result;
  }
}

export default new QbitTorrent();
