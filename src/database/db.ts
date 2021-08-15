import fb from "firebase";
import { firebaseConfig } from "./creds.json";

class DB {
  myProject: fb.app.App;
  constructor() {
      this.myProject = fb.initializeApp(firebaseConfig);
  }

  public async addtodb(data : any[]) {
    for (let i = 0; i < data.length; i++) {
      // console.log(data[i]["mediaId"].toString());]);
      
      await this.myProject.firestore().collection("animelists").doc("387521").collection("anime").doc(data[i]["mediaId"].toString()).set(data[i]);
    }
  }
}
export default DB;
