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
             await setDoc(userRef, {
               displayName: u.displayName,
               email: u.email,
               photoURL: u.photoURL,
               isOnline: true,
               lastSeen: serverTimestamp(),
               shortId: newId
             });
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
    return (
      <div className="min-h-screen bg-[#111B21] flex flex-col items-center justify-center p-4">
        <div className="max-w-md w-full bg-[#202C33] rounded-2xl shadow-2xl overflow-hidden">
          <div className="bg-[#00A884] p-8 text-center text-white">
            <MessageSquare className="w-16 h-16 mx-auto mb-4 opacity-90" />
            <h1 className="text-3xl font-light tracking-tight">ChatConnect</h1>
            <p className="mt-2 text-green-100 opacity-80">Message privately with E2E experience</p>
          </div>
          <div className="p-8 pb-10 text-center">
            <p className="text-gray-400 mb-8 leading-relaxed">
              Sign in to start messaging with friends, family, and colleagues.
              Secure, fast, and simple.
            </p>
            <button
              onClick={signInWithGoogle}
              className="w-full bg-[#00A884] hover:bg-[#008f6f] text-white font-medium py-3 px-4 rounded-lg transition-colors flex items-center justify-center gap-3"
            >
              <svg viewBox="0 0 24 24" className="w-5 h-5 fill-current" xmlns="http://www.w3.org/2000/svg">
                <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" fill="#4285F4"/>
                <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853"/>
                <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" fill="#FBBC05"/>
                <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335"/>
              </svg>
              Continue with Google
            </button>
          </div>
        </div>
      </div>
    );
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
