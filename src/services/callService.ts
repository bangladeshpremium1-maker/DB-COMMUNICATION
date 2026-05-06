import { db } from '../lib/firebase';
import { collection, addDoc, doc, updateDoc, serverTimestamp, getDoc } from 'firebase/firestore';

export const callService = {
  async initiateCall(callerId: string, receiverId: string, type: 'voice' | 'video') {
    const callRef = await addDoc(collection(db, 'calls'), {
      callerId,
      receiverId,
      type,
      status: 'ringing',
      createdAt: serverTimestamp(),
    });
    return callRef.id;
  },

  async answerCall(callId: string) {
    await updateDoc(doc(db, 'calls', callId), { status: 'accepted' });
  },

  async endCall(callId: string) {
    await updateDoc(doc(db, 'calls', callId), { status: 'ended' });
  },

  async rejectCall(callId: string) {
    await updateDoc(doc(db, 'calls', callId), { status: 'rejected' });
  }
};
