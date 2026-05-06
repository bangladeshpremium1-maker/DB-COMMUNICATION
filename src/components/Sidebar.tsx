import { useState, useMemo } from 'react';
import { useChats, useUsers } from '../hooks/useFirebase';
import { useAppStore } from '../store';
import { MoreVertical, MessageSquarePlus, Search, User as UserIcon, X, LogOut, QrCode, Edit2, Users, Megaphone, CircleDashed } from 'lucide-react';
import { format } from 'date-fns';
import { db } from '../lib/firebase';
import { collection, addDoc, serverTimestamp, query, where, getDocs, updateDoc, doc } from 'firebase/firestore';
import { handleFirestoreError, OperationType } from '../lib/firestore-error';
import QRCode from 'react-qr-code';
import { QrScanner } from './QrScanner';
import * as ReactWindow from 'react-window';
// @ts-ignore
const FixedSizeList = (ReactWindow.FixedSizeList || (ReactWindow as any).default?.FixedSizeList) as any;
import { AutoSizer as AutoSizerComponent } from 'react-virtualized-auto-sizer';
const AutoSizer = (AutoSizerComponent || (AutoSizerComponent as any).default) as any;

export function Sidebar({ onLogout }: { onLogout: () => void }) {
  const { currentUser, currentUserDoc, selectedChatId, setSelectedChatId } = useAppStore();
  const chats = useChats(currentUser?.uid);
  const users = useUsers();

  const unifiedList = useMemo(() => {
    if (!currentUser) return [];

    // Filter out current user from all users
    const allOtherUsers = users.filter(u => u.id !== currentUser.uid);

    // Get IDs of users we already have a direct chat with
    const directChatUserIds = new Set(
      chats
        .filter(c => c.type === 'direct')
        .flatMap(c => c.participants.filter(p => p !== currentUser.uid))
    );

    // Users who don't have a chat yet
    const nonChattedUsers = allOtherUsers.filter(u => !directChatUserIds.has(u.id));

    // Convert non-chatted users to "virtual chat" objects
    const virtualChats = nonChattedUsers.map(u => ({
      id: `virtual-${u.id}`,
      type: 'direct' as const,
      participants: [currentUser.uid, u.id],
      updatedAt: null,
      lastMessage: u.phoneNumber || u.email || 'Start a conversation',
      isVirtual: true,
      otherUser: u
    }));

    // Combine actual chats with virtual chats
    // Meta AI is already handled in displayUsers for starting chats, but let's ensure it's in the main list too if requested
    // "ALL USERS AUTOMATIC COME"
    
    const actualChatsWithUsers = chats.map(c => {
        const otherUserId = c.participants.find(p => p !== currentUser.uid);
        const otherUser = users.find(u => u.id === otherUserId);
        return { ...c, otherUser };
    });

    return [...actualChatsWithUsers, ...virtualChats].sort((a, b) => {
        if (a.updatedAt && b.updatedAt) return b.updatedAt.toMillis() - a.updatedAt.toMillis();
        if (a.updatedAt) return -1;
        if (b.updatedAt) return 1;
        return (a.otherUser?.displayName || '').localeCompare(b.otherUser?.displayName || '');
    });
  }, [chats, users, currentUser]);
  
  const [isNewChatOpen, setIsNewChatOpen] = useState(false);
  const [isProfileOpen, setIsProfileOpen] = useState(false);
  const [isScannerOpen, setIsScannerOpen] = useState(false);
  const [creatingType, setCreatingType] = useState<'group' | 'community' | 'channel' | null>(null);
  const [isStatusOpen, setIsStatusOpen] = useState(false);
  const [selectedGroupParticipants, setSelectedGroupParticipants] = useState<string[]>([]);
  const [isGroupNameModalOpen, setIsGroupNameModalOpen] = useState(false);
  const [groupName, setGroupName] = useState('');
  const [searchQuery, setSearchQuery] = useState('');
  const [isEditingStatus, setIsEditingStatus] = useState(false);
  const [newStatus, setNewStatus] = useState('');

  // No need to find currentUserDoc here as it's in the store
  
  const updateStatusMessage = async () => {
      if (!currentUser) return;
      try {
          await updateDoc(doc(db, 'users', currentUser.uid), {
              statusMessage: newStatus
          });
          setIsEditingStatus(false);
      } catch (error) {
          handleFirestoreError(error, OperationType.UPDATE, 'users');
      }
  };

  const handleCreateGroup = async () => {
    if (!currentUser || selectedGroupParticipants.length === 0 || !groupName.trim()) return;

    try {
      const type = creatingType || 'group';
      const chatRef = await addDoc(collection(db, 'chats'), {
        type: type,
        participants: [currentUser.uid, ...selectedGroupParticipants],
        name: groupName,
        updatedAt: serverTimestamp(),
      });
      setSelectedChatId(chatRef.id);
      setCreatingType(null);
      setSelectedGroupParticipants([]);
      setIsGroupNameModalOpen(false);
      setIsNewChatOpen(false);
    } catch (error) {
      handleFirestoreError(error, OperationType.CREATE, 'chats');
    }
  };

  const otherUsers = users.filter(u => u.id !== currentUser?.uid && (
     u.displayName.toLowerCase().includes(searchQuery.toLowerCase()) ||
     (u.shortId && u.shortId.toLowerCase() === searchQuery.toLowerCase())
  ));

  const metaAI = {
      id: 'meta-ai',
      displayName: 'Meta AI',
      photoURL: 'https://cdn-icons-png.flaticon.com/512/4712/4712038.png'
  };

  const displayUsers = [metaAI, ...otherUsers].filter(u => 
      u.displayName.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const handleStartChat = async (otherUserId: string) => {
    if (!currentUser) return;

    // Check if chat already exists
    const q = query(
      collection(db, 'chats'),
      where('participants', 'array-contains', currentUser.uid)
    );
    try {
      const snap = await getDocs(q);
      const existingChat = snap.docs.find(d => {
        const p = d.data().participants as string[];
        return p.includes(otherUserId) && p.length === 2 && d.data().type === 'direct';
      });

      if (existingChat) {
        setSelectedChatId(existingChat.id);
        setIsNewChatOpen(false);
        return;
      }

      // Create new chat
      const chatRef = await addDoc(collection(db, 'chats'), {
        type: 'direct',
        participants: [currentUser.uid, otherUserId],
        updatedAt: serverTimestamp(),
      });
      setSelectedChatId(chatRef.id);
      setIsNewChatOpen(false);
    } catch (error) {
      handleFirestoreError(error, OperationType.CREATE, 'chats');
    }
  };

  return (
    <>
      <div className="h-[60px] flex items-center justify-between px-4 bg-[#f0f2f5]">
        <div className="flex items-center gap-3 p-1.5 -ml-1.5 rounded-lg w-[60%] transition-colors">
          <div className="cursor-pointer flex-shrink-0" onClick={() => setIsProfileOpen(true)} title="View Profile">
            {currentUserDoc?.photoURL || currentUser?.photoURL ? (
              <img src={currentUserDoc?.photoURL || (currentUser?.photoURL as string)} alt="Profile" className="w-10 h-10 rounded-full object-cover" />
            ) : (
              <div className="w-10 h-10 rounded-full bg-[#dfe5e7] flex items-center justify-center text-gray-500 overflow-hidden">
                <UserIcon className="text-gray-500 w-6 h-6" />
              </div>
            )}
          </div>
          <div className="flex flex-col min-w-0 flex-1">
            <span className="font-medium text-[#111b21] truncate cursor-pointer" onClick={() => setIsProfileOpen(true)}>{currentUserDoc?.displayName || currentUser?.displayName}</span>
            <input 
              key={currentUserDoc?.statusMessage || 'init'}
              type="text" 
              placeholder="Set status message..." 
              className="text-[13px] text-[#54656f] bg-transparent border-none outline-none truncate w-full mt-[-2px] hover:bg-black/5 rounded px-1 -ml-1 transition-colors"
              defaultValue={currentUserDoc?.statusMessage || 'Available'}
              onBlur={async (e) => {
                 if (!currentUser) return;
                 const val = e.target.value.trim();
                 if (val !== currentUserDoc?.statusMessage) {
                     try {
                         await updateDoc(doc(db, 'users', currentUser.uid), { statusMessage: val || 'Available' });
                     } catch (err) {}
                 }
              }}
              onKeyDown={(e) => {
                 if (e.key === 'Enter') {
                     e.currentTarget.blur();
                 }
              }}
            />
          </div>
        </div>
        <div className="flex space-x-6 text-[#54656f]">
          <button onClick={() => setIsStatusOpen(true)} className="hover:text-[#111b21] transition-colors" title="Status">
            <CircleDashed className="w-5 h-5" />
          </button>
          <button onClick={() => setIsNewChatOpen(true)} className="hover:text-[#111b21] transition-colors" title="New Chat">
            <MessageSquarePlus className="w-5 h-5" />
          </button>
          <button onClick={onLogout} className="hover:text-[#111b21] transition-colors" title="Logout">
            <LogOut className="w-5 h-5" />
          </button>
        </div>
      </div>

      <div className="p-2 border-b border-[#f0f2f5]">
        <div className="bg-[#f0f2f5] rounded-lg flex items-center px-3 py-1.5 focus-within:bg-white focus-within:shadow-sm focus-within:ring-1 focus-within:ring-[#00a884]">
          <Search className="text-[#54656f] mr-4 w-5 h-5" />
          <input
            type="text"
            placeholder="Search or start new chat"
            className="bg-transparent w-full text-sm outline-none placeholder-[#667781] text-[#3b4a54]"
          />
        </div>
      </div>

      <div className="flex-1 overflow-hidden relative">
        {/* @ts-ignore */}
        <AutoSizer>
          {({ height, width }: any) => {
            if (!height || !width) return null;
            return (
              <FixedSizeList
                key={`chats-list-${unifiedList.length}`}
                height={height}
                itemCount={unifiedList.length}
                itemSize={72}
                width={width}
                itemData={{
                  unifiedList,
                  currentUser,
                  users,
                  selectedChatId,
                  setSelectedChatId,
                  handleStartChat
                }}
              >
              {({ index, style, data }) => {
                const item = data.unifiedList[index];
                const currentUser = data.currentUser;
                const selectedChatId = data.selectedChatId;
                const setSelectedChatId = data.setSelectedChatId;
                const handleStartChat = data.handleStartChat;
                
                const otherUser = item.otherUser || (item.id === 'meta-ai' ? {
                  id: 'meta-ai',
                  displayName: 'Meta AI',
                  photoURL: 'https://cdn-icons-png.flaticon.com/512/4712/4712038.png'
                } : null);
                
                const isSelected = selectedChatId === item.id;
                
                return (
                  <div 
                    style={style}
                    onClick={() => {
                        if (item.isVirtual) {
                            handleStartChat(otherUser.id);
                        } else {
                            setSelectedChatId(item.id);
                        }
                    }}
                    className={`flex items-center px-3 py-3 cursor-pointer transition-colors border-b border-[#f0f2f5] ${isSelected ? 'bg-[#ebebeb]' : 'hover:bg-[#f5f6f6] bg-white'}`}
                  >
                    {item.type === 'group' ? (
                      <div className="w-12 h-12 rounded-full bg-gray-300 mr-3 flex items-center justify-center flex-shrink-0 text-white">
                        <span className="text-xl">👥</span>
                      </div>
                    ) : otherUser?.photoURL ? (
                      <img src={otherUser.photoURL} alt="" className="w-12 h-12 rounded-full mr-3 object-cover" />
                    ) : (
                      <div className="w-12 h-12 rounded-full bg-[#00a884] mr-3 flex items-center justify-center flex-shrink-0 text-white">
                        <span className="text-sm font-bold">{otherUser?.displayName?.substring(0, 2).toUpperCase() || 'U'}</span>
                      </div>
                    )}
                    <div className="flex-1 min-w-0 pb-1">
                      <div className="flex justify-between items-baseline mb-1">
                        <h3 className="text-[16px] font-medium truncate text-[#111b21]">{item.name || otherUser?.displayName || 'Unknown'}</h3>
                        {item.updatedAt && (
                          <span className="text-xs text-[#667781]">
                            {format(item.updatedAt?.toDate() || new Date(), 'HH:mm')}
                          </span>
                        )}
                      </div>
                      <div className="text-sm text-[#667781] truncate">
                        {item.otherUser?.phoneNumber && <span className="text-xs text-gray-400 mr-1">[{item.otherUser.phoneNumber}]</span>}
                        {item.typing?.[otherUser?.id || ''] ? <span className="text-[#00a884]">typing...</span> : (item.type === 'direct' ? (otherUser?.statusMessage || item.lastMessage || 'Start a conversation') : (item.lastMessage || 'Start a conversation'))}
                      </div>
                    </div>
                  </div>
                );
              }}
            </FixedSizeList>
            );
          }}
        </AutoSizer>
      </div>

      {/* New Chat Slide-over */}
      {isNewChatOpen && (
        <div className="absolute inset-0 bg-white z-10 flex flex-col animate-in slide-in-from-left duration-200">
          <div className="h-[100px] bg-[#008069] flex items-end px-4 pb-4">
            <button onClick={() => setIsNewChatOpen(false)} className="text-white hover:text-[#d9fdd3] mr-6">
              <X className="w-6 h-6" />
            </button>
            <h2 className="text-xl font-medium text-white">{creatingType ? `Add ${creatingType} participants` : 'New chat'}</h2>
          </div>
          
          {!creatingType ? (
            <div className="p-4 border-b border-[#f0f2f5] flex flex-col gap-2">
              <div 
                 onClick={() => setCreatingType('group')}
                 className="flex items-center gap-3 cursor-pointer hover:bg-[#f5f6f6] p-2 rounded-lg"
              >
                  <div className="w-12 h-12 rounded-full bg-[#008069] flex items-center justify-center text-white">
                      <MessageSquarePlus className="w-6 h-6" />
                  </div>
                  <span className="font-medium text-[#111b21]">New group chat</span>
              </div>
              <div 
                 onClick={() => setCreatingType('community')}
                 className="flex items-center gap-3 cursor-pointer hover:bg-[#f5f6f6] p-2 rounded-lg"
              >
                  <div className="w-12 h-12 rounded-full bg-[#008069] flex items-center justify-center text-white">
                      <Users className="w-6 h-6" />
                  </div>
                  <span className="font-medium text-[#111b21]">New community</span>
              </div>
              <div 
                 onClick={() => setCreatingType('channel')}
                 className="flex items-center gap-3 cursor-pointer hover:bg-[#f5f6f6] p-2 rounded-lg"
              >
                  <div className="w-12 h-12 rounded-full bg-[#008069] flex items-center justify-center text-white">
                      <Megaphone className="w-6 h-6" />
                  </div>
                  <span className="font-medium text-[#111b21]">New channel</span>
              </div>
            </div>
          ) : (
            <div className="p-4 border-b border-[#f0f2f5]">
                <button 
                  onClick={() => {
                    setCreatingType(null);
                    setSelectedGroupParticipants([]);
                  }}
                  className="text-sm text-[#008069] mb-2"
                >
                    Back
                </button>
                <div className="flex flex-wrap gap-2 mb-4">
                    {selectedGroupParticipants.map(uid => {
                        const user = users.find(u => u.id === uid);
                        return (
                            <span key={uid} className="bg-[#d9fdd3] text-[#111b21] px-2 py-1 rounded text-xs">
                                {user?.displayName}
                            </span>
                        )
                    })}
                </div>
            </div>
          )}

          <div className="p-2 border-b border-[#f0f2f5]">
            <div className="flex gap-2">
              <div className="flex-1 bg-[#f0f2f5] flex items-center px-3 py-1.5 rounded-lg focus-within:bg-white focus-within:shadow-sm focus-within:ring-1 focus-within:ring-[#00a884]">
                <Search className="w-5 h-5 text-[#54656f] mr-3" />
                <input
                  type="text"
                  placeholder="Search..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="bg-transparent border-none outline-none text-sm w-full text-[#111b21] placeholder-[#667781]"
                />
              </div>
              {!creatingType && (
                <button 
                  onClick={() => setIsScannerOpen(true)}
                  className="bg-[#00a884] text-white p-2 rounded-lg hover:bg-[#008f6f] transition-colors flex items-center justify-center"
                  title="Scan QR Code"
                >
                  <QrCode className="w-5 h-5" />
                </button>
              )}
            </div>
          </div>

          <div className="flex-1 overflow-hidden relative">
            {/* @ts-ignore */}
            <AutoSizer>
              {({ height, width }: any) => {
                if (!height || !width) return null;
                return (
                  <FixedSizeList
                    key={`display-users-list-${displayUsers.length}`}
                    height={height}
                    itemCount={displayUsers.length}
                    itemSize={72}
                    width={width}
                    itemData={{
                      displayUsers,
                      creatingType,
                      selectedGroupParticipants,
                      setSelectedGroupParticipants,
                      handleStartChat,
                    }}
                  >
                  {({ index, style, data }) => {
                    const user = data.displayUsers[index];
                    const creatingType = data.creatingType;
                    const selectedGroupParticipants = data.selectedGroupParticipants;
                    const setSelectedGroupParticipants = data.setSelectedGroupParticipants;
                    const handleStartChat = data.handleStartChat;
                    
                    return (
                      <div 
                        style={style}
                        onClick={() => {
                            if (creatingType) {
                                if (user.id === 'meta-ai') return; // Cannot add meta-ai to group
                                if (selectedGroupParticipants.includes(user.id)) {
                                    setSelectedGroupParticipants((prev: string[]) => prev.filter(id => id !== user.id));
                                } else {
                                    setSelectedGroupParticipants((prev: string[]) => [...prev, user.id]);
                                }
                            } else {
                                handleStartChat(user.id);
                            }
                        }}
                        className={`flex items-center px-3 py-3 cursor-pointer hover:bg-[#f5f6f6] border-b border-[#f0f2f5] transition-colors ${creatingType && user.id === 'meta-ai' ? 'opacity-50 min-h-0' : ''}`}
                      >
                        <div className={`w-12 h-12 rounded-full mr-3 flex items-center justify-center flex-shrink-0 text-white ${user.id === 'meta-ai' ? 'bg-gradient-to-tr from-blue-500 via-indigo-500 to-purple-500 ring-2 ring-offset-1 ring-purple-400 p-[1px]' : 'bg-[#00a884]'}`}>
                            {user.photoURL ? (
                                <img src={user.photoURL} alt="" className="w-12 h-12 rounded-full object-cover" />
                            ) : (
                                <span className="text-sm font-bold">{user.displayName.substring(0, 2).toUpperCase()}</span>
                            )}
                            {creatingType && user.id !== 'meta-ai' && (
                              <div className={`absolute w-3 h-3 rounded-full border-2 border-white ${selectedGroupParticipants.includes(user.id) ? 'bg-green-500' : 'bg-transparent'}`}></div>
                            )}
                        </div>
                        <div className="flex-1 min-w-0 pb-1">
                          <h3 className="text-[16px] font-medium truncate text-[#111b21]">{user.displayName}</h3>
                          {user.id === 'meta-ai' && <p className="text-xs text-[#54656f]">Ask Meta AI anything</p>}
                        </div>
                      </div>
                    );
                  }}
                </FixedSizeList>
                );
              }}
            </AutoSizer>
          </div>
          
          {creatingType && selectedGroupParticipants.length > 0 && (
              <div className="p-4 bg-white border-t">
                  <button onClick={() => setIsGroupNameModalOpen(true)} className="w-full bg-[#00a884] text-white py-2 rounded-lg font-medium">Create {creatingType}</button>
              </div>
          )}
        </div>
      )}

      {/* Profile Slide-over */}
      {isProfileOpen && (
        <div className="absolute inset-0 bg-[#f0f2f5] z-20 flex flex-col animate-in slide-in-from-left duration-200">
          <div className="h-[100px] bg-[#008069] flex items-end px-4 pb-4 flex-shrink-0">
            <button onClick={() => setIsProfileOpen(false)} className="text-white hover:text-[#d9fdd3] mr-6">
              <X className="w-6 h-6" />
            </button>
            <h2 className="text-xl font-medium text-white">Profile</h2>
          </div>
          
          <div className="flex-1 overflow-y-auto w-full">
            <div className="flex flex-col items-center justify-center p-8 bg-white mb-2 shadow-sm">
              {currentUserDoc?.photoURL || currentUser?.photoURL ? (
                <img src={currentUserDoc?.photoURL || (currentUser?.photoURL as string)} alt="Profile" className="w-[200px] h-[200px] rounded-full object-cover mb-6 shadow-md" />
              ) : (
                <div className="w-[200px] h-[200px] rounded-full bg-[#dfe5e7] flex items-center justify-center text-gray-500 overflow-hidden mb-6 shadow-md">
                  <UserIcon className="text-gray-500 w-24 h-24" />
                </div>
              )}
            </div>

            <div className="bg-white p-6 shadow-sm mb-2">
              <div className="text-sm text-[#008069] font-medium mb-2">Your Name</div>
              <div className="text-[17px] text-[#111b21]">{currentUserDoc?.displayName || currentUser?.displayName}</div>
            </div>

            <div className="bg-white p-6 shadow-sm mb-2">
              <div className="text-sm text-[#008069] font-medium mb-2">Phone Number</div>
              <div className="text-[17px] text-[#111b21]">{currentUserDoc?.phoneNumber || 'Not provided'}</div>
            </div>

            <div className="bg-white p-6 shadow-sm mb-2">
              <div className="text-sm text-[#008069] font-medium mb-2">Status</div>
              {isEditingStatus ? (
                  <div className="flex gap-2">
                    <input 
                      type="text"
                      className="flex-1 border-b border-[#008069] outline-none text-[17px] text-[#111b21]"
                      value={newStatus}
                      onChange={(e) => setNewStatus(e.target.value)}
                    />
                    <button onClick={updateStatusMessage} className="text-[#008069]">Save</button>
                  </div>
              ) : (
                  <div className="flex justify-between items-center text-[17px] text-[#111b21]">
                    {currentUserDoc?.statusMessage || 'Available'}
                    <Edit2 size={16} className="text-[#54656f] cursor-pointer" onClick={() => { setIsEditingStatus(true); setNewStatus(currentUserDoc?.statusMessage || ''); }} />
                  </div>
              )}
            </div>

            <div className="bg-white p-6 shadow-sm flex flex-col items-center py-10">
              <div className="text-sm text-[#54656f] text-center mb-6 max-w-[250px]">
                Your friends can scan this QR code or use your 5-digit ID to find you.
              </div>
              
              <div className="bg-white p-4 rounded-xl shadow-sm border border-gray-100 mb-6 flex flex-col items-center">
                {currentUserDoc?.shortId ? (
                   <QRCode value={currentUserDoc.shortId} size={180} fgColor="#111b21" />
                ) : (
                   <div className="w-[180px] h-[180px] bg-gray-100 animate-pulse rounded-lg flex items-center justify-center text-gray-400">Loading...</div>
                )}
                <div className="mt-6 flex flex-col items-center">
                  <span className="text-xs text-[#54656f] uppercase tracking-wider font-semibold mb-1">Your ID</span>
                  <span className="text-3xl font-mono tracking-widest text-[#111b21]">{currentUserDoc?.shortId || '-----'}</span>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
      {isGroupNameModalOpen && (
        <div className="absolute inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
            <div className="bg-white p-6 rounded-lg w-full max-w-sm">
                <h2 className="text-xl font-medium mb-4">Name your group</h2>
                <input 
                    type="text"
                    value={groupName}
                    onChange={(e) => setGroupName(e.target.value)}
                    placeholder="Group name"
                    className="w-full p-2 border rounded-lg mb-4"
                />
                <div className="flex justify-end gap-2">
                    <button onClick={() => setIsGroupNameModalOpen(false)} className="px-4 py-2 text-gray-500">Cancel</button>
                    <button onClick={handleCreateGroup} className="px-4 py-2 bg-[#00a884] text-white rounded-lg">Create</button>
                </div>
            </div>
        </div>
      )}
      
      {/* Status Slide-over */}
      {isStatusOpen && (
        <div className="absolute inset-0 bg-[#f0f2f5] z-30 flex flex-col animate-in slide-in-from-left duration-200">
          <div className="h-[100px] bg-[#008069] flex items-end px-4 pb-4 flex-shrink-0">
            <button onClick={() => setIsStatusOpen(false)} className="text-white hover:text-[#d9fdd3] mr-6">
              <X className="w-6 h-6" />
            </button>
            <h2 className="text-xl font-medium text-white">Status</h2>
          </div>
          
          <div className="flex-1 overflow-y-auto w-full p-4">
             <div className="bg-white p-4 rounded-lg shadow-sm flex items-center gap-4 cursor-pointer hover:bg-gray-50 mb-4" onClick={() => alert('Status image upload not implemented')}>
                 <div className="relative">
                     <div className="w-12 h-12 rounded-full bg-gray-200 overflow-hidden">
                        {currentUser?.photoURL ? <img src={currentUser.photoURL} alt="" /> : <UserIcon className="w-full h-full text-gray-400 p-2" />}
                     </div>
                     <div className="absolute bottom-0 right-0 w-4 h-4 bg-[#00a884] items-center justify-center rounded-full border-2 border-white flex text-white text-[10px] font-bold">+</div>
                 </div>
                 <div>
                     <h3 className="font-medium text-[#111b21]">My Status</h3>
                     <p className="text-sm text-[#54656f]">Tap to add status update</p>
                 </div>
             </div>
             <p className="text-sm text-[#54656f] font-medium uppercase tracking-wider mb-2 px-2">Recent updates</p>
             <div className="text-center p-8 text-sm text-[#54656f] bg-white rounded-lg shadow-sm">
                 No recent updates.
             </div>
          </div>
        </div>
      )}
      
      {/* Scanner Slide-over */}
      {isScannerOpen && (
        <QrScanner 
          onClose={() => setIsScannerOpen(false)}
          onScan={(text) => {
            setIsScannerOpen(false);
            
            if (text.startsWith('DEVICE-LINK-')) {
               alert('Initiating device linking process: ' + text);
               return;
            }

            setSearchQuery(text);
            
            // Try to auto-start chat if exactly one user matches
            const matchingUser = users.find(u => (u.shortId === text || u.id === text) && u.id !== currentUser?.uid);
            if (matchingUser) {
              handleStartChat(matchingUser.id);
            }
          }}
        />
      )}
    </>
  );
}
