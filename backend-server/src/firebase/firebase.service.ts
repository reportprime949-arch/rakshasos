import * as admin from 'firebase-admin';import { Injectable, OnModuleInit } from '@nestjs/common';
import * as admin from 'firebase-admin';

@Injectable()
export class FirebaseService implements OnModuleInit {
  private firebaseApp: admin.app.App;

  onModuleInit() {
    try {
      if (!admin.apps.length) {
        if (!process.env.FIREBASE_PRIVATE_KEY || process.env.FIREBASE_PRIVATE_KEY === 'your-private-key') {
           throw new Error('Firebase credentials not configured');
        }
        
        this.firebaseApp = admin.initializeApp({
          credential: admin.credential.cert({
            projectId: process.env.FIREBASE_PROJECT_ID,
            clientEmail: process.env.FIREBASE_CLIENT_EMAIL,
            privateKey: process.env.FIREBASE_PRIVATE_KEY?.replace(/\\n/g, '\n'),
          }),
        });
        console.log('✅ [FIREBASE] Admin SDK Initialized');
      } else {
        this.firebaseApp = admin.app();
      }
    } catch (err) {
      console.warn(`⚠️ [FIREBASE] SDK Initialization Failed: ${err.message}`);
      console.warn('Firebase features (Notifications, Firestore sync) will be disabled.');
    }
  }

  getFirestore() {
    if (!this.firebaseApp) return null;
    return admin.firestore();
  }

 getMessaging(): admin.messaging.Messaging {
  return admin.messaging();
}

  async sendPushNotification(token: string, title: string, body: string, data?: any) {
    if (!this.firebaseApp) {
      console.log(`📡 [MOCK PUSH] To: ${token} | ${title}: ${body}`);
      return;
    }
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
