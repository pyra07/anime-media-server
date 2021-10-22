import fb from "firebase";
import { firebaseConfig } from "./creds.json";
import { id, aniUserName, email, emailPassword } from "../../profile.json";
import { nextAiringEpisode, status } from "../utils/types";
import firebase from "firebase";

class DB {
  private myProject: fb.app.App;
  private static user: fb.auth.UserCredential;
  constructor() {
    this.myProject = fb.initializeApp(firebaseConfig);
  }

  public async logIn() {
    DB.user = await this.myProject
      .auth()
      .signInWithEmailAndPassword(email, emailPassword);
  }

  /**
   * Adds data to firestore
   * @param  {any[]} data
   * @returns Promise
   */
  public async addToDb(...data: any[]): Promise<void> {
    for (let i = 0; i < data.length; i++) {
      await this.myProject
        .firestore()
        .collection("animelists")
        .doc(DB.user.user?.uid)
        .collection("anime")
        .doc(data[i]["mediaId"].toString())
        .set(data[i]);
    }
  }

  public async modifyAnimeEntry(mediaId: string, data: Object) {
    try {
      await this.myProject
        .firestore()
        .collection("animelists")
        .doc(DB.user.user?.uid)
        .collection("anime")
        .doc(mediaId)
        .update(data);
      return true;
    } catch (error) {
      console.error(error);
      return false;
    }
  }

  public async getByMediaId(mediaId: string) {
    return await this.myProject
      .firestore()
      .collection("animelists")
      .doc(DB.user.user?.uid)
      .collection("anime")
      .doc(mediaId)
      .get();
  }

  public async getAnimeEntries(...mediaId: string[]) {
    /* If the length of the mediaId array is greater than 10, we need to split it up into chunks of 10
      and then call the getAnimeEntries function on each chunk. 
      This is because firebase is gay*/

    let chunks: string[][] = [];
    let animeEntries: fb.firestore.DocumentData[] = [];

    if (mediaId.length > 10) {
      for (let i = 0; i < mediaId.length; i += 10) {
        chunks.push(mediaId.slice(i, i + 10));
      }
    }

    for (const chunk of chunks) {
      const entries = await this.myProject
        .firestore()
        .collection("animelists")
        .doc(DB.user.user?.uid)
        .collection("anime")
        .where(firebase.firestore.FieldPath.documentId(), "in", chunk)
        .get();
      animeEntries.push(...entries.docs.map((doc) => doc.data()));
    }
    return animeEntries;
  }

  /**
   * Gets the users animelist
   * @param  {string} mediaId
   * @returns {Promise}
   */
  public async getFromDb(): Promise<
    fb.firestore.QuerySnapshot<fb.firestore.DocumentData> | undefined
  > {
    try {
      return await this.myProject
        .firestore()
        .collection("animelists")
        .doc(DB.user.user?.uid)
        .collection("anime")
        .get();
    } catch (error) {
      console.error(error);
      return undefined;
    }
  }

  public async createUserDB() {
    await this.myProject
      .firestore()
      .collection("animelists")
      .doc(DB.user.user?.uid)
      .set({
        Username: aniUserName,
        "Anilist ID": id,
        "Date Created": firebase.firestore.FieldValue.serverTimestamp(),
      });
  }
}
export default new DB();
