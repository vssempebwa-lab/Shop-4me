import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import App from './App.tsx';
import './index.css';

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>
);
// Import the functions you need from the SDKs you need
import { initializeApp } from "firebase/app";
import { getAnalytics } from "firebase/analytics";
// TODO: Add SDKs for Firebase products that you want to use
// https://firebase.google.com/docs/web/setup#available-libraries

// Your web app's Firebase configuration
// For Firebase JS SDK v7.20.0 and later, measurementId is optional
const firebaseConfig = {
  apiKey: "AIzaSyAQMEhsukryUlcMuJgZfAelTkJYIOYWbmw",
  authDomain: "shop4me-fef09.firebaseapp.com",
  projectId: "shop4me-fef09",
  storageBucket: "shop4me-fef09.firebasestorage.app",
  messagingSenderId: "406512516513",
  appId: "1:406512516513:web:0231a36bc7e36c5b1f5fe0",
  measurementId: "G-WXJ6JNLE72"
};

// Initialize Firebase
const app = initializeApp(firebaseConfig);
getAnalytics(app);