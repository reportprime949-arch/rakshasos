import { Injectable, OnModuleInit } from '@nestjs/common';
import * as admin from 'firebase-admin';

@Injectable()
export class FirebaseService implements OnModuleInit {
  private firebaseApp: admin.app.App;

  onModuleInit() {
    if (!admin.apps.length) {
      this.firebaseApp = admin.initializeApp({
        credential: admin.credential.cert({
          projectId: process.env.FIREBASE_PROJECT_ID,
          clientEmail: process.env.FIREBASE_CLIENT_EMAIL,
          privateKey: process.env.FIREBASE_PRIVATE_KEY?.replace(/\\n/g, '\n'),
        }),
      });
    } else {
      this.firebaseApp = admin.app();
    }
  }

  getFirestore() {
    return admin.firestore();
  }

  getMessaging() {
    return admin.messaging();
  }

  async sendPushNotification(token: string, title: string, body: string, data?: any) {
    try {
      await admin.messaging().send({
        token,
        notification: {
          title,
          body,
        },
        data: data || {},
      });
    } catch (error) {
      console.error('Error sending push notification:', error);
    }
  }
}
