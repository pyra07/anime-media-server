import fb from "firebase";
import { firebaseConfig } from "./creds.json";
import { id } from "../../profile.json";

class DB {
  myProject: fb.app.App;
  constructor() {
    this.myProject = fb.initializeApp(firebaseConfig);
  }

  /**
   * Adds data to firestore
   * @param  {any[]} data
   * @returns Promise
   */
  public async addToDb(data: any[]): Promise<void> {
    for (let i = 0; i < data.length; i++) {
      await this.myProject
        .firestore()
        .collection("animelists")
        .doc(id.toString())
        .collection("anime")
        .doc(data[i]["mediaId"].toString())
        .set(data[i]);
    }
  }

  public async updateProgress(mediaId: string, progress: number) {
    await this.myProject
      .firestore()
      .collection("animelists")
      .doc(id.toString())
      .collection("anime")
      .doc(mediaId)
      .update({ progress });
  }

  /**
   * Gets the users animelist
   * @param  {string} mediaId
   * @returns Promise
   */
  public async getFromDb(): Promise<
    fb.firestore.QuerySnapshot<fb.firestore.DocumentData>
  > {
    return await this.myProject
      .firestore()
      .collection("animelists")
      .doc(id.toString())
      .collection("anime")
      .get();
  }
}
export default new DB();
