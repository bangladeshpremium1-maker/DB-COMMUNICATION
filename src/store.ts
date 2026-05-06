import { create } from 'zustand';

interface User {
  uid: string;
  displayName: string;
  email: string;
  photoURL: string;
}

interface UserDoc extends User {
  blockedUsers?: string[];
  pinnedChats?: string[];
  archivedChats?: string[];
  lockedChats?: string[];
  isOnline?: boolean;
  lastSeen?: any;
  shortId?: string;
  statusMessage?: string;
}

interface AppState {
  currentUser: User | null;
  setCurrentUser: (user: User | null) => void;
  
  currentUserDoc: UserDoc | null;
  setCurrentUserDoc: (doc: UserDoc | null) => void;
  
  selectedChatId: string | null;
  setSelectedChatId: (id: string | null) => void;

  isSidebarOpen: boolean;
  setSidebarOpen: (isOpen: boolean) => void;
  
  activeCall: any | null;
  setActiveCall: (call: any | null) => void;
}

export const useAppStore = create<AppState>((set) => ({
  currentUser: null,
  setCurrentUser: (user) => set({ currentUser: user }),

  currentUserDoc: null,
  setCurrentUserDoc: (doc) => set({ currentUserDoc: doc }),

  selectedChatId: null,
  setSelectedChatId: (id) => set({ selectedChatId: id }),

  isSidebarOpen: true,
  setSidebarOpen: (isOpen) => set({ isSidebarOpen: isOpen }),
  
  activeCall: null,
  setActiveCall: (call) => set({ activeCall: call }),
}));
