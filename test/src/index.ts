import { auth } from "firebase-functions/v1"
import * as admin from "firebase-admin"

const app = admin.initializeApp()

exports.createUserDoc = auth.user().onCreate((user) => {
    // Your new auth record will have the uid and email on it because
    // you used email as the way to create the auth record
    return app.firestore().collection("users").doc(user.uid).set({
      email: user.email,
      name: user.email,
      workspaces: []
    })
});