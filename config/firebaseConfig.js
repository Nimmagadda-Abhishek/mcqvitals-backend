// Import the functions you need from the SDKs you need
import { initializeApp } from "firebase/app";
import { getAnalytics } from "firebase/analytics";
// TODO: Add SDKs for Firebase products that you want to use
// https://firebase.google.com/docs/web/setup#available-libraries

// Your web app's Firebase configuration
// For Firebase JS SDK v7.20.0 and later, measurementId is optional
const firebaseConfig = {
    apiKey: "AIzaSyAwbL_qPYERJgTIGDg_AzpnV_AKAaL_G04",
    authDomain: "mcqvitals.firebaseapp.com",
    projectId: "mcqvitals",
    storageBucket: "mcqvitals.firebasestorage.app",
    messagingSenderId: "686580990573",
    appId: "1:686580990573:web:6a7a7be3c95311c1203564",
    measurementId: "G-Z3W5WEH9V6"
};

// Initialize Firebase
const app = initializeApp(firebaseConfig);
const analytics = getAnalytics(app);