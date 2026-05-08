importScripts('https://www.gstatic.com/firebasejs/9.0.0/firebase-app-compat.js');
importScripts('https://www.gstatic.com/firebasejs/9.0.0/firebase-messaging-compat.js');

firebase.initializeApp({
  apiKey: "AIzaSyDpVjhkMTU4P4pfWDVyIfFm5J4IU1waIjE",
  authDomain: "rakshasos-9b2dd.firebaseapp.com",
  projectId: "rakshasos-9b2dd",
  storageBucket: "rakshasos-9b2dd.firebasestorage.app",
  messagingSenderId: "994526856680",
  appId: "1:994526856680:web:7b9dcaf3684d63b7b4d05d",
});

const messaging = firebase.messaging();

messaging.onBackgroundMessage((payload) => {
  console.log('Received background message ', payload);
  const notificationTitle = payload.notification.title;
  const notificationOptions = {
    body: payload.notification.body,
    icon: '/logo.png'
  };

  self.registration.showNotification(notificationTitle, notificationOptions);
});
