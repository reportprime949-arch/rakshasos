import { useEffect } from 'react';
import { db } from '@/lib/firebase';
import { collection, query, onSnapshot, orderBy, limit, where } from 'firebase/firestore';
import { useAdminStore } from '@/store/useAdminStore';

export const useAdminFirestore = () => {
  const { setEmergencies, updateEmergency } = useAdminStore();

  useEffect(() => {
    const q = query(
      collection(db, 'emergencies'),
      orderBy('createdAt', 'desc'),
      limit(50)
    );

    const unsubscribe = onSnapshot(q, (snapshot) => {
      const emergencies = snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data(),
        createdAt: doc.data().createdAt?.toDate()?.toISOString() || new Date().toISOString(),
        updatedAt: doc.data().updatedAt?.toDate()?.toISOString() || new Date().toISOString(),
      }));
      
      setEmergencies(emergencies);
    });

    return () => unsubscribe();
  }, [setEmergencies]);

  useEffect(() => {
    const q = query(collection(db, 'officers'), where('active', '==', true));
    const unsubscribe = onSnapshot(q, (snapshot) => {
      const officers = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
      useAdminStore.getState().setOfficers(officers);
    });
    return () => unsubscribe();
  }, []);

  return {};
};
