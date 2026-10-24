const firebaseConfig = {
  apiKey: "তোমার-বর্তমান-apiKey",
  authDomain: "addabd.firebaseapp.com",
  projectId: "addabd",
  storageBucket: "addabd.firebasestorage.app",
  messagingSenderId: "তোমার-বর্তমান-messagingSenderId",
  appId: "তোমার-বর্তমান-appId",
  measurementId: "তোমার-বর্তমান-measurementId"
};

firebase.initializeApp(firebaseConfig);

const auth = firebase.auth();
const db = firebase.firestore();

auth.languageCode = "bn";
auth.setPersistence(firebase.auth.Auth.Persistence.LOCAL)
  .catch(error => console.error("Session persistence:", error));
