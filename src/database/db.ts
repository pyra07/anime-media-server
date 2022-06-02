import fb from "firebase";
import { firebaseConfig } from "database/creds.json";
import { id, aniUserName, email, emailPassword } from "profile.json";
import { AniQuery } from "utils";
import firebase from "firebase";

class DB {
  private myProject: fb.app.App;
  private static user: fb.auth.UserCredential;
  constructor() {
    this.myProject = fb.initializeApp(firebaseConfig);
  }

  public async logIn() {
    // offline persistence
    DB.user = await this.myProject
      .auth()
      .signInWithEmailAndPassword(email, emailPassword);
  }

  /**
   * Adds data to firestore
   * @param  {any[]} data
   * @returns Promise
   */
  public async addToDb(...data: AniQuery[]): Promise<void> {
    for (let i = 0; i < data.length; i++) {
      const dataToAdd = data[i];
      await this.myProject
        .firestore()
        .collection("animelists")
        .doc(DB.user.user?.uid)
        .collection("anime")
        .doc(dataToAdd["mediaId"].toString())
        .set(dataToAdd, { merge: false });
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

  public async deleteAnimeEntry(mediaId: string): Promise<void> {
    try {
      await this.myProject
        .firestore()
        .collection("animelists")
        .doc(DB.user.user?.uid)
        .collection("anime")
        .doc(mediaId)
        .delete();
    } catch (error) {
      console.error(error);
    }
  }

  public async getByMediaId(mediaId: string) {
    return await this.myProject
      .firestore()
      .collection("animelists")
      .doc(DB.user.user?.uid)
      .collection("anime")
      .doc(mediaId)
      .get({ source: "server" });
  }

  public async getAnimeEntries(...mediaId: string[]) {
    let animeEntries = [];
    for (let i = 0; i < mediaId.length; i++) {
      const data = await this.getByMediaId(mediaId[i]);

      // Make sure the data is not undefined
      if (data) {
        const entry = data.data();
        if (entry) animeEntries.push(entry);
        // else return [];
      }
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
