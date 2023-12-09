import axios from "axios";
import path from "path/posix";
import { qbit_url, password, username, rootDir } from "profile.json";

class QbitTorrent {
  private sid?: string;

  // Function to authenticate and get the SID (Session ID)
  private async authenticate() {
    const authLink = new URL(qbit_url);
    authLink.pathname = "/api/v2/auth/login";

    try {
      const response = await axios.post(
        authLink.toString(),
        `username=${encodeURIComponent(username)}&password=${encodeURIComponent(
          password
        )}`,
        {
          headers: {
            "Content-Type": "application/x-www-form-urlencoded",
          },
        }
      );

      const cookie = response.headers["set-cookie"];
      if (cookie) {
        const sidMatch = /SID=([^;]+)/.exec(cookie[0]);
        this.sid = sidMatch ? sidMatch[1] : undefined;
      } else {
        console.error("Authentication failed. No session cookie received.");
      }
    } catch (error) {
      console.error("Error during authentication:", error);
    }
  }

  // Function to add a torrent using the obtained SID
  public async addTorrent(
    link: string,
    title: string,
    episodeStr?: string
  ): Promise<boolean> {
    const authLink = new URL(qbit_url);
    authLink.pathname = "/api/v2/torrents/add";
    link = link.replace("nyaa.si", "nyaa.land");

    try {
      const response = await axios.post(
        authLink.toString(),
        `urls=${encodeURIComponent(link)}&savepath=${encodeURIComponent(
          path.join(rootDir, title)
        )}&rename=${encodeURIComponent(
          episodeStr ? `${title} - ${episodeStr}` : title
        )}`,
        {
          headers: {
            "Content-Type": "application/x-www-form-urlencoded",
            // Cookie: `SID=${this.sid}`,
          },
        }
      );

      if (response.data === "Ok.") {
        return true;
      } else {
        console.log("No data", response);

        return false;
      }
    } catch (error) {
      console.log(error);

      return false;
    }
  }
}

export default new QbitTorrent();
