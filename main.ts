import profile from "./profile.json";
import anilist from "./src/Anilist/anilist";
import fs from "fs";
import ui from "./src/UI/ui";

(async () => {
  // Check if every key in profile is not null or empty
  Object.entries(profile).forEach(async ([key, value]) => {
    if (value === 0 || value === "") {
      if (key === "id") {
        const data = await anilist.customQuery(
          "query ($name : String){ User(name: $name) { id } }",
          { name: profile.aniUserName }
        );
        profile.id = data.data.User.id;
        fs.writeFileSync("./profile.json", JSON.stringify(profile, null, 2));
      } else throw new Error(`${key} is not defined in profile.json`);
    }
  });

  ui.init();
})();
