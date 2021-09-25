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
  public async addToDb(data: any[]): Promise<void> {
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

  /**
   * Updates your anime progression
   * @param  {string} mediaId
   * @param  {number} progress
   * @returns {Promise}
   */
  public async updateProgress(
    mediaId: string,
    nextAiringEpisode: nextAiringEpisode | null,
    status: status,
    downloadedEpisodes: number[]
  ): Promise<void> {
    await this.myProject
      .firestore()
      .collection("animelists")
      .doc(DB.user.user?.uid)
      .collection("anime")
      .doc(mediaId)
      .update({
        "media.nextAiringEpisode": nextAiringEpisode,
        "media.status": status,
        downloadedEpisodes: firebase.firestore.FieldValue.arrayUnion(
          ...downloadedEpisodes
        ),
      });
  }

  /**
   * Gets the users animelist
   * @param  {string} mediaId
   * @returns {Promise}
   */
  public async getFromDb(): Promise<
    fb.firestore.QuerySnapshot<fb.firestore.DocumentData>
  > {
    return await this.myProject
      .firestore()
      .collection("animelists")
      .doc(DB.user.user?.uid)
      .collection("anime")
      .get();
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
