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

  public async addTorrent(links: string[]): Promise<boolean> {
    // Add each torrent link, and wait 1000ms for each
    for (const link of links) {
      await this.client.addMagnet(link);
      await new Promise((resolve) => setTimeout(resolve, 1000));
    }

    return true;
  }
}

export default new QbitTorrent();
