import { QBittorrent } from "@ctrl/qbittorrent";

class QbitTorrent {
  client: QBittorrent;

  constructor() {
    this.client = new QBittorrent({
      baseUrl: "http://localhost:8080/",
      username: "admin",
      password: "owoowo",
    });
  }

  public async addTorrent(link: string): Promise<boolean> {
    const result = await this.client.addMagnet(link);
    return result;
  }
}

export default new QbitTorrent();
