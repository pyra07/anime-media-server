import { Resolution, SearchMode } from "@utils/index";
import { findBestMatch } from "string-similarity";
import anitomy from "anitomy-js";
import readline from "readline";
import { verifyQuery } from "./utils";

function testVerify() {
  const cl = readline.createInterface({
    input: process.stdin,
    output: process.stdout,
  });
  const input = cl.question("Enter anime: ", (a) => {
    const animeParsedData = anitomy.parseSync(a);
    const v = verifyQuery(
      "The Daily Life of the Immortal King",
      animeParsedData,
      Resolution.FHD,
      SearchMode.BATCH,
      ["01", "12"]
    );
    console.log(v);
  });
}

testVerify();
