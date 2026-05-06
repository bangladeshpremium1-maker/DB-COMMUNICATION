import { useEffect, useState } from 'react';
import { 
  collection, query, where, onSnapshot, orderBy, 
  doc, setDoc, serverTimestamp, getDocs 
} from 'firebase/firestore';
import { auth, db } from '../lib/firebase';
import { handleFirestoreError, OperationType } from '../lib/firestore-error';

export interface UserProfile {
  id: string;
  displayName: string;
  email: string;
  photoURL: string;
  isOnline: boolean;
  lastSeen?: any;
  statusMessage?: string;
  shortId?: string;
  blockedUsers?: string[];
  pinnedChats?: string[];
  archivedChats?: string[];
  lockedChats?: string[];
  uid?: string;
}

export interface Chat {
  id: string;
  type: 'direct' | 'group';
  participants: string[];
  updatedAt: any;
  lastMessage?: string;
  name?: string;
  typing?: Record<string, boolean>;
}

export interface Message {
  id: string;
  text: string;
  senderId: string;
  createdAt: any;
  status: 'sent' | 'delivered' | 'read';
  mediaUrl?: string;
  mediaType?: 'image' | 'video' | 'audio' | 'location';
  deleted?: boolean;
  replyToId?: string;
  reactions?: Record<string, string>;
  location?: { latitude: number, longitude: number };
}

export function useChats(currentUserId: string | undefined) {
  const [chats, setChats] = useState<Chat[]>([]);

  useEffect(() => {
    if (!currentUserId) {
      setChats([]);
      return;
    }

    const q = query(
      collection(db, 'chats'),
      where('participants', 'array-contains', currentUserId),
      orderBy('updatedAt', 'desc')
    );

    const unsubscribe = onSnapshot(q, (snapshot) => {
      const chatsData = snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      })) as Chat[];
      setChats(chatsData);
    }, (error) => {
      handleFirestoreError(error, OperationType.LIST, 'chats');
    });

    return () => unsubscribe();
  }, [currentUserId]);

  return chats;
}

export function useMessages(chatId: string | null) {
  const [messages, setMessages] = useState<Message[]>([]);

  useEffect(() => {
    if (!chatId) {
      setMessages([]);
      return;
    }

    const path = `chats/${chatId}/messages`;
    const q = query(
      collection(db, path),
      orderBy('createdAt', 'asc')
    );

    const unsubscribe = onSnapshot(q, (snapshot) => {
      const msgs = snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      })) as Message[];
      setMessages(msgs);
    }, (error) => {
      handleFirestoreError(error, OperationType.LIST, path);
    });

    return () => unsubscribe();
  }, [chatId]);

  return messages;
}

export function useUsers() {
  const [users, setUsers] = useState<UserProfile[]>([]);

  useEffect(() => {
    const unsubscribe = onSnapshot(collection(db, 'users'), (snapshot) => {
      setUsers(snapshot.docs.map(d => ({ id: d.id, ...d.data() }) as UserProfile));
    }, (error) => {
      handleFirestoreError(error, OperationType.LIST, 'users');
    });
    return () => unsubscribe();
  }, []);

  return users;
}
