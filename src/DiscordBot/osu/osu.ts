import axios from "axios";
import { osuAPI } from "../../../profile.json";
import { Match } from "./util/types";

class Osu {
  private osu: string;
  constructor() {
    this.osu = "https://osu.ppy.sh/api";
  }

  public async getMatch(match: string): Promise<Match | null> {
      const response = await axios.get(`${this.osu}/get_match?k=${osuAPI}&mp=${match}`);
        if (response.data.length === 0) {
          return null;
        }
        return response.data as Match;
    
  }
}

export default new Osu();
