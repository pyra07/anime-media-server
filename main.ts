import DB from "./src/database/db";
import data from "./users.json";
(async () => {

await new DB().addtodb(data);

})();