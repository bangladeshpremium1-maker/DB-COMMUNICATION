/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { useEffect, useState } from 'react';
import { onAuthStateChanged } from 'firebase/auth';
import { auth, signInWithGoogle, logOut } from './lib/firebase';
import { useAppStore } from './store';
import { doc, setDoc, serverTimestamp, getDoc, updateDoc } from 'firebase/firestore';
import { db } from './lib/firebase';
import { handleFirestoreError, OperationType } from './lib/firestore-error';
import { Sidebar } from './components/Sidebar';
import { ChatWindow } from './components/ChatWindow';
import { Auth } from './components/Auth';
import { MessageSquare, Loader2 } from 'lucide-react';
import { cn } from './lib/utils';
import { collection, query, where, onSnapshot } from 'firebase/firestore';
import { CallUI } from './components/CallUI';
import { IncomingCallOverlay } from './components/IncomingCallOverlay';
import { callService } from './services/callService';

export default function App() {
  const { currentUser, setCurrentUser, currentUserDoc, setCurrentUserDoc, selectedChatId, activeCall, setActiveCall } = useAppStore();
  const [loading, setLoading] = useState(true);
  const [incomingCall, setIncomingCall] = useState<any | null>(null);

  // Auth Effect
  useEffect(() => {
    const unsub = onAuthStateChanged(auth, async (user) => {
      if (user) {
        const u = {
          uid: user.uid,
          displayName: user.displayName || 'Anonymous',
          email: user.email || '',
          photoURL: user.photoURL || '',
        };
        setCurrentUser(u);
        
        // Presence and Profile setup
        try {
          const userRef = doc(db, 'users', user.uid);
          const userSnap = await getDoc(userRef);
          
          if (!userSnap.exists()) {
             const newId = Math.random().toString(36).substring(2, 7).toUpperCase();
             const pendingPhone = localStorage.getItem('pending_phone');
             await setDoc(userRef, {
               displayName: u.displayName,
               email: u.email,
               phoneNumber: pendingPhone || '',
               photoURL: u.photoURL,
               isOnline: true,
               lastSeen: serverTimestamp(),
               shortId: newId
             });
             localStorage.removeItem('pending_phone');
          } else {
             await updateDoc(userRef, {
               isOnline: true,
               lastSeen: serverTimestamp(),
               displayName: u.displayName,
               photoURL: u.photoURL
             });
             
             const data = userSnap.data();
             if (!data.shortId) {
                const newId = Math.random().toString(36).substring(2, 7).toUpperCase();
                await updateDoc(userRef, { shortId: newId });
             }
          }
        } catch (e) {
          handleFirestoreError(e, OperationType.WRITE, `users/${user.uid}`);
        }
      } else {
        setCurrentUser(null);
        setCurrentUserDoc(null);
      }
      setLoading(false);
    });

    return () => unsub();
  }, [setCurrentUser]);

  // User Data Sync Effect
  useEffect(() => {
    if (!currentUser) return;
    const unsub = onSnapshot(doc(db, 'users', currentUser.uid), (snap) => {
      if (snap.exists()) {
        setCurrentUserDoc({ uid: snap.id, id: snap.id, ...snap.data() } as any);
      }
    });
    return () => unsub();
  }, [currentUser, setCurrentUserDoc]);

  // Calls Effect
  useEffect(() => {
     if(!currentUser) return;
     const q = query(collection(db, 'calls'), where('receiverId', '==', currentUser.uid), where('status', '==', 'ringing'));
     const unsub = onSnapshot(q, (snapshot) => {
         snapshot.docChanges().forEach((change) => {
             if(change.type === 'added') {
                 const callData = change.doc.data();
                 if (currentUserDoc?.blockedUsers?.includes(callData.callerId)) {
                     // Reject silently if blocked
                     callService.rejectCall(change.doc.id);
                     return;
                 }
                 setIncomingCall({id: change.doc.id, ...callData});
             } else if(change.type === 'removed') {
                 setIncomingCall(null);
             }
         });
     });
     
     const handleUnload = () => {
         updateDoc(doc(db, 'users', currentUser.uid), { isOnline: false });
     };
     window.addEventListener('beforeunload', handleUnload);
     return () => { 
         unsub();
         window.removeEventListener('beforeunload', handleUnload);
         handleUnload();
     };
  }, [currentUser]);

  if (loading) {
    return (
      <div className="min-h-screen bg-neutral-900 flex items-center justify-center">
        <Loader2 className="w-8 h-8 text-green-500 animate-spin" />
      </div>
    );
  }

  if (!currentUser) {
    return <Auth />;
  }

  return (
    <div className="flex h-screen bg-[#f0f2f5] overflow-hidden font-sans text-[#111b21] antialiased">
      {activeCall && (
        <CallUI 
           callId={activeCall.id} 
           type={activeCall.type} 
           onEnd={async () => {
              await callService.endCall(activeCall.id);
              setActiveCall(null);
           }}
        />
      )}
      {incomingCall && (
        <IncomingCallOverlay 
          call={incomingCall} 
          onAccept={async (id) => {
              await callService.answerCall(id);
              setActiveCall({id, type: incomingCall.type});
              setIncomingCall(null);
          }}
          onReject={async (id) => {
              await callService.rejectCall(id);
              setIncomingCall(null);
          }}
        />
      )}
      <div className={cn(
        "w-full md:w-[350px] border-r border-[#d1d7db] bg-white flex-shrink-0 flex flex-col",
        selectedChatId ? "hidden md:flex" : "flex"
      )}>
        <Sidebar onLogout={logOut} />
      </div>
      
      <div className={cn(
        "flex-1 bg-[#f0f2f5] flex flex-col items-center justify-center relative",
        selectedChatId ? "flex" : "hidden md:flex"
      )}>
        {selectedChatId ? (
          <ChatWindow />
        ) : (
          <div className="text-center px-8">
            <div className="inline-flex items-center justify-center w-24 h-24 rounded-full bg-[#dfe5e7] mb-6 text-[#54656f]">
              <MessageSquare className="w-12 h-12" />
            </div>
            <h2 className="text-3xl font-light mb-4 text-[#3b4a54]">ChatConnect for Web</h2>
            <p className="text-[#667781] max-w-md mx-auto leading-relaxed">
              Send and receive messages without keeping your phone online.
              End-to-end encryption is used between your device and our servers.
            </p>
          </div>
        )}
      </div>
    </div>
  );
}
