const firebaseConfig = {
  apiKey: "AIzaSyB3RsUpOo5c481sgAD2KFh6xs45VVuJhc8",
  authDomain: "addabd.firebaseapp.com",
  projectId: "addabd",
  storageBucket: "addabd.firebasestorage.app",
  messagingSenderId: "489130728558",
  appId: "1:489130728558:web:ddc5b6a6355c95c6b99a7f",
  measurementId: "G-YHWEHNJMTW"
};

firebase.initializeApp(firebaseConfig);

const auth = firebase.auth();
const db = firebase.firestore();

auth.languageCode = "bn";
