import { useState, useRef, useEffect, ChangeEvent, KeyboardEvent } from 'react';
import { useAppStore } from '../store';
import { useChats, useMessages, useUsers } from '../hooks/useFirebase';
import { MoreVertical, Search, Paperclip, Smile, Mic, Send, Info, User as UserIcon, ArrowLeft, Phone, Video, X, FileText, Image as ImageIcon, Camera, MapPin, BarChart2, Calendar } from 'lucide-react';
import { db } from '../lib/firebase';
import { addDoc, collection, serverTimestamp, doc, updateDoc } from 'firebase/firestore';
import { format } from 'date-fns';
import { handleFirestoreError, OperationType } from '../lib/firestore-error';
import { callService } from '../services/callService';
import { AudioPlayer } from './AudioPlayer';
import { AddMemberModal } from './AddMemberModal';

export function ChatWindow() {
  const { currentUser, currentUserDoc, selectedChatId, setSelectedChatId, setActiveCall } = useAppStore();
  const chats = useChats(currentUser?.uid);
  const users = useUsers();
  const rawMessages = useMessages(selectedChatId);
  const messages = rawMessages.filter(m => !currentUserDoc?.blockedUsers?.includes(m.senderId));
  
  const [inputText, setInputText] = useState('');
  const [isRecording, setIsRecording] = useState(false);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const audioChunksRef = useRef<BlobPart[]>([]);

  const startRecording = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const mediaRecorder = new MediaRecorder(stream);
      mediaRecorderRef.current = mediaRecorder;
      audioChunksRef.current = [];

      mediaRecorder.ondataavailable = (event) => {
        if (event.data.size > 0) {
          audioChunksRef.current.push(event.data);
        }
      };

      mediaRecorder.onstop = async () => {
        const audioBlob = new Blob(audioChunksRef.current, { type: 'audio/webm' });
        await uploadAudio(audioBlob);
      };

      mediaRecorder.start();
      setIsRecording(true);
    } catch (err) {
      console.error("Microphone access denied:", err);
      alert("Please allow microphone access to send voice messages.");
    }
  };

  const stopRecording = () => {
    if (mediaRecorderRef.current && isRecording) {
      mediaRecorderRef.current.stop();
      setIsRecording(false);
      mediaRecorderRef.current.stream.getTracks().forEach(track => track.stop());
    }
  };

  const uploadAudio = async (audioBlob: Blob) => {
    if (!currentUser || !selectedChatId) return;
    setIsUploading(true);
    try {
      const sigRes = await fetch('/api/cloudinary/signature', { method: 'POST' });
      const sigData = await sigRes.json();
      
      const formData = new FormData();
      formData.append('file', audioBlob, 'voicemessage.webm');
      formData.append('api_key', sigData.apiKey);
      formData.append('timestamp', sigData.timestamp);
      formData.append('signature', sigData.signature);
      formData.append('folder', 'chat_media');
      formData.append('resource_type', 'video');

      const uploadUrl = `https://api.cloudinary.com/v1_1/${sigData.cloudName}/auto/upload`;
      const uploadRes = await fetch(uploadUrl, {
        method: 'POST',
        body: formData,
      });

      const uploadedFile = await uploadRes.json();

      const messageCol = collection(db, `chats/${selectedChatId}/messages`);
      await addDoc(messageCol, {
        text: 'Sent voice message',
        senderId: currentUser.uid,
        createdAt: serverTimestamp(),
        status: 'sent',
        mediaUrl: uploadedFile.secure_url,
        mediaType: 'audio'
      });

      await updateDoc(doc(db, 'chats', selectedChatId), {
        lastMessage: '🎤 Voice message',
        updatedAt: serverTimestamp()
      });
    } catch (e: any) {
      console.error(e);
      alert('Upload failed: ' + e.message);
    } finally {
      setIsUploading(false);
    }
  };
  
  const typingTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const isTypingRef = useRef(false);

  const previousChatIdRef = useRef<string | null>(null);

  useEffect(() => {
    const prevChatId = previousChatIdRef.current;
    if (prevChatId && prevChatId !== selectedChatId && isTypingRef.current && currentUser) {
        // Clear typing status on the old chat
        updateDoc(doc(db, 'chats', prevChatId), {
            [`typing.${currentUser.uid}`]: false
        }).catch(console.error);
    }
    
    if (prevChatId !== selectedChatId) {
        if (typingTimeoutRef.current) {
            clearTimeout(typingTimeoutRef.current);
        }
        isTypingRef.current = false;
        previousChatIdRef.current = selectedChatId;
    }
  }, [selectedChatId, currentUser]);

  useEffect(() => {
    return () => {
      if (typingTimeoutRef.current) {
        clearTimeout(typingTimeoutRef.current);
      }
    };
  }, []);

  const handleTyping = async (text: string) => {
      setInputText(text);

      if (!selectedChatId || !currentUser) return;

      const currentlyTyping = text.trim().length > 0;

      if (currentlyTyping && !isTypingRef.current) {
          isTypingRef.current = true;
          await updateDoc(doc(db, 'chats', selectedChatId), {
              [`typing.${currentUser.uid}`]: true
          });
      } else if (!currentlyTyping && isTypingRef.current) {
          isTypingRef.current = false;
          await updateDoc(doc(db, 'chats', selectedChatId), {
              [`typing.${currentUser.uid}`]: false
          });
      }

      if (typingTimeoutRef.current) {
          clearTimeout(typingTimeoutRef.current);
      }

      if (currentlyTyping) {
          typingTimeoutRef.current = setTimeout(async () => {
              isTypingRef.current = false;
              await updateDoc(doc(db, 'chats', selectedChatId), {
                  [`typing.${currentUser.uid}`]: false
              });
          }, 3000);
      }
  };

  const [isUploading, setIsUploading] = useState(false);
  const [isAITyping, setIsAITyping] = useState(false);
  const [isAttachmentMenuOpen, setIsAttachmentMenuOpen] = useState(false);
  const [editingMessageId, setEditingMessageId] = useState<string | null>(null);
  const [replyingTo, setReplyingTo] = useState<any | null>(null);
  const [contextMenu, setContextMenu] = useState<{ x: number, y: number, msgId: string } | null>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const [isHeaderMenuOpen, setIsHeaderMenuOpen] = useState(false);
  const [isGroupManageOpen, setIsGroupManageOpen] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const cameraInputRef = useRef<HTMLInputElement>(null);

  const chat = chats.find(c => c.id === selectedChatId);
  const otherUserId = chat?.participants.find(p => p !== currentUser?.uid);
  let otherUser = users.find(u => u.id === otherUserId);
  
  if (!otherUser && otherUserId === 'meta-ai') {
    otherUser = {
      id: 'meta-ai',
      displayName: 'Meta AI',
      photoURL: 'https://cdn-icons-png.flaticon.com/512/4712/4712038.png',
      isOnline: true,
      email: 'meta-ai@whatsapp.com'
    } as any;
  }
  
  const isBlocked = currentUserDoc?.blockedUsers?.includes(otherUser?.id);
  const isPinned = currentUserDoc?.pinnedChats?.includes(selectedChatId);
  const isArchived = currentUserDoc?.archivedChats?.includes(selectedChatId);
  const isLocked = currentUserDoc?.lockedChats?.includes(selectedChatId);

  const [isInfoOpen, setIsInfoOpen] = useState(false);
  const [exportWithMedia, setExportWithMedia] = useState(false);
  const [showExportModal, setShowExportModal] = useState(false);

  const handleExportChat = () => {
    let content = `Chat Export - ${chat?.name || otherUser?.displayName}\n\n`;
    messages.forEach(m => {
      const sender = m.senderId === currentUser?.uid ? 'You' : users.find(u => u.uid === m.senderId || u.id === m.senderId)?.displayName || 'Unknown';
      content += `[${format(m.createdAt instanceof Date ? m.createdAt : new Date(m.createdAt?.seconds * 1000 || Date.now()), 'PP pp')}] ${sender}: ${m.text}\n`;
      if (exportWithMedia && m.mediaUrl) {
        content += `[Media Attachment: ${m.mediaUrl}]\n`;
      }
    });

    const blob = new Blob([content], { type: 'text/plain' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `WhatsApp_Chat_${chat?.name || otherUser?.displayName}.txt`;
    a.click();
    URL.revokeObjectURL(url);
    setShowExportModal(false);
  };

  const handleUserPreference = async (type: 'blockedUsers' | 'pinnedChats' | 'archivedChats' | 'lockedChats', targetId: string, currentStatus: boolean) => {
    if (!currentUser) return;
    try {
      const currentArray = currentUserDoc?.[type] || [];
      const newArray = currentStatus
        ? currentArray.filter((id: string) => id !== targetId)
        : [...currentArray, targetId];

      await updateDoc(doc(db, 'users', currentUser.uid), {
        [type]: newArray
      });
    } catch (err) {
      console.error(`Error updating ${type}:`, err);
    }
  };

  const handleEdit = (msg: any) => {
    setEditingMessageId(msg.id);
    setInputText(msg.text);
    setContextMenu(null);
  };

  const handleReply = (msg: any) => {
    setReplyingTo(msg);
    setContextMenu(null);
  }

  const handleReaction = async (msgId: string, emoji: string) => {
    try {
      const msg = messages.find(m => m.id === msgId);
      if (!msg || !currentUser) return;

      const currentReactions = msg.reactions || {};
      const newReactions = { ...currentReactions };

      if (newReactions[currentUser.uid] === emoji) {
        delete newReactions[currentUser.uid];
      } else {
        newReactions[currentUser.uid] = emoji;
      }

      await updateDoc(doc(db, `chats/${selectedChatId}/messages`, msgId), {
        reactions: newReactions
      });
    } catch (e) {
      console.error(e);
    }
    setContextMenu(null);
  };

  const handleDelete = async (msgId: string) => {
    try {
      await updateDoc(doc(db, `chats/${selectedChatId}/messages`, msgId), {
        text: 'This message was deleted',
        deleted: true
      });
    } catch (e) {
      console.error(e);
    }
    setContextMenu(null);
  };

  const handleSpeak = (text: string) => {
    const utterance = new SpeechSynthesisUtterance(text);
    window.speechSynthesis.speak(utterance);
    setContextMenu(null);
  };


  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'auto' });
  }, [messages]);

  const handleFileUpload = async (e: ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !currentUser || !selectedChatId) return;

    setIsUploading(true);
    try {
      const sigRes = await fetch('/api/cloudinary/signature', { method: 'POST' });
      const sigData = await sigRes.json();

      if (!sigData.cloudName) {
        throw new Error("Cloudinary not configured properly");
      }

      const formData = new FormData();
      formData.append('file', file);
      formData.append('api_key', sigData.apiKey);
      formData.append('timestamp', sigData.timestamp);
      formData.append('signature', sigData.signature);
      formData.append('folder', 'chat_media');

      const uploadUrl = `https://api.cloudinary.com/v1_1/${sigData.cloudName}/auto/upload`;
      const uploadRes = await fetch(uploadUrl, {
        method: 'POST',
        body: formData,
      });

      const uploadedFile = await uploadRes.json();

      let mediaType = 'image';
      if (uploadedFile.resource_type === 'video') {
        mediaType = file.type.startsWith('audio/') ? 'audio' : 'video';
      }

      const messageCol = collection(db, `chats/${selectedChatId}/messages`);
      await addDoc(messageCol, {
        text: 'Sent media',
        senderId: currentUser.uid,
        createdAt: serverTimestamp(),
        status: 'sent',
        mediaUrl: uploadedFile.secure_url,
        mediaType
      });

      await updateDoc(doc(db, 'chats', selectedChatId), {
        lastMessage: '📷 Media',
        updatedAt: serverTimestamp()
      });

    } catch (e: any) {
      console.error(e);
      alert('Upload failed: ' + e.message);
    } finally {
      setIsUploading(false);
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  };

  const renderMessageText = (text: string) => {
    const urlRegex = /(https?:\/\/[^\s]+)/g;
    return text.split(urlRegex).map((part, index) => {
      if (part.match(urlRegex)) {
        return <a key={index} href={part} target="_blank" rel="noopener noreferrer" className="text-blue-500 underline">{part}</a>;
      }
      return part;
    });
  };

  const handleSend = async () => {
    if (!inputText.trim() || !currentUser || !selectedChatId) return;

    const isAIChat = otherUser?.id === 'meta-ai';
    const text = inputText.trim();

    if (editingMessageId) {
      try {
        await updateDoc(doc(db, `chats/${selectedChatId}/messages`, editingMessageId), {
          text: text
        });
        setEditingMessageId(null);
      } catch (e) {
        handleFirestoreError(e, OperationType.UPDATE, `chats/${selectedChatId}/messages/${editingMessageId}`);
      }
    } else {
      try {
        const messageCol = collection(db, `chats/${selectedChatId}/messages`);
        const newMsg: any = {
          text,
          senderId: currentUser.uid,
          createdAt: serverTimestamp(),
          status: 'sent'
        };
        if (replyingTo) {
          newMsg.replyToId = replyingTo.id;
        }
        await addDoc(messageCol, newMsg);

        await updateDoc(doc(db, 'chats', selectedChatId), {
          lastMessage: text,
          updatedAt: serverTimestamp()
        });
        setReplyingTo(null);

        if (isAIChat) {
          const history = messages
            .filter(m => !m.deleted)
            .map(m => ({
              role: m.senderId === currentUser.uid ? 'user' : 'model',
              parts: [{ text: m.text }]
            }));

          setIsAITyping(true);
          try {
            const { aiService } = await import('../services/aiService');
            const aiResponse = await aiService.sendMessage(text, history as any);

            await addDoc(messageCol, {
              text: aiResponse,
              senderId: 'meta-ai',
              createdAt: serverTimestamp(),
              status: 'sent'
            });

            await updateDoc(doc(db, 'chats', selectedChatId), {
              lastMessage: aiResponse,
              updatedAt: serverTimestamp()
            });
          } finally {
            setIsAITyping(false);
          }
        }
      } catch (e) {
        handleFirestoreError(e, OperationType.CREATE, `chats/${selectedChatId}/messages`);
      }
    }

    setInputText('');

    if (isTypingRef.current) {
      if (typingTimeoutRef.current) clearTimeout(typingTimeoutRef.current);
      isTypingRef.current = false;
      updateDoc(doc(db, 'chats', selectedChatId), {
        [`typing.${currentUser.uid}`]: false
      }).catch(console.error);
    }
  };

  const handleKeyPress = (e: KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  if (!chat || (!otherUser && chat.type === 'direct')) return null;

  const chatName = chat.name || otherUser?.displayName || 'Unknown';

  const typingUsers = Object.entries(chat.typing || {})
    .filter(([uid, isTyping]) => isTyping && uid !== currentUser?.uid)
    .map(([uid]) => users.find(u => u.uid === uid || u.id === uid)?.displayName?.split(' ')[0])
    .filter(Boolean);

  let typingText = '';
  if (typingUsers.length > 0) {
    if (chat.type === 'direct') {
      typingText = 'typing...';
    } else {
      if (typingUsers.length === 1) {
        typingText = `${typingUsers[0]} is typing...`;
      } else if (typingUsers.length === 2) {
        typingText = `${typingUsers[0]} and ${typingUsers[1]} are typing...`;
      } else {
        typingText = 'Several people are typing...';
      }
    }
  }

  let headerSubText = '';
  if (chat.type === 'group') {
    headerSubText = typingText || `${chat.participants.length} participants`;
  } else {
    headerSubText = isAITyping ? 'typing...' : (typingText || (otherUser?.isOnline ? 'online' : 'offline'));
  }

  return (
    <div className="flex-1 flex flex-row w-full h-full relative overflow-hidden">
      <div className="flex-1 flex flex-col min-w-0">
        {/* Header */}
        <header className="h-[60px] bg-[#f0f2f5] px-4 flex items-center justify-between border-b border-[#d1d7db] z-10">
          <div className="flex items-center cursor-pointer flex-1" onClick={() => setIsInfoOpen(!isInfoOpen)}>
            <button className="md:hidden text-[#54656f] mr-2" onClick={(e) => { e.stopPropagation(); setSelectedChatId(null); }}>
               <ArrowLeft className="w-6 h-6" />
            </button>
            
            {otherUser?.id === 'meta-ai' ? (
                <div className="w-10 h-10 rounded-full mr-3 bg-gradient-to-tr from-blue-500 via-indigo-500 to-purple-500 ring-2 ring-offset-1 ring-purple-400 p-[1px]">
                    <img src="https://cdn-icons-png.flaticon.com/512/4712/4712038.png" alt="" className="w-full h-full rounded-full object-cover" />
                </div>
            ) : otherUser?.photoURL ? (
              <img src={otherUser.photoURL} alt="" className="w-10 h-10 rounded-full mr-3" />
            ) : (
              <div className="w-10 h-10 rounded-full bg-[#00a884] flex items-center justify-center text-white mr-3">
                <span className="text-sm font-bold">{chatName.substring(0, 2).toUpperCase()}</span>
              </div>
            )}
            
            <div>
              <h2 className="text-[16px] font-medium leading-tight text-[#111b21]">{chatName}</h2>
              <p className="text-xs text-[#667781]">{headerSubText}</p>
            </div>
          </div>
          <div className="flex space-x-6 text-[#54656f]">
            <button 
               className="hover:text-[#111b21] transition-colors" 
               title="Voice Call"
               onClick={async () => {
                  if (!currentUser || !otherUserId || isBlocked) return;
                  const callId = await callService.initiateCall(currentUser.uid, otherUserId, 'voice');
                  setActiveCall({ id: callId, type: 'voice' });
               }}
            >
              <Phone className="w-5 h-5" />
            </button>
            <button 
               className="hover:text-[#111b21] transition-colors" 
               title="Video Call"
               onClick={async () => {
                  if (!currentUser || !otherUserId || isBlocked) return;
                  const callId = await callService.initiateCall(currentUser.uid, otherUserId, 'video');
                  setActiveCall({ id: callId, type: 'video' });
               }}
            >
              <Video className="w-5 h-5" />
            </button>
            <button className="hover:text-[#111b21] transition-colors" title="Search">
              <Search className="w-5 h-5" />
            </button>
            <div className="relative">
               <button className="hover:text-[#111b21] transition-colors" title="More info" onClick={() => setIsHeaderMenuOpen(!isHeaderMenuOpen)}>
                   <MoreVertical className="w-5 h-5" />
               </button>
               {isHeaderMenuOpen && (
                  <div className="absolute top-8 right-0 bg-white rounded-lg shadow-xl border border-gray-100 py-2 z-50 w-56 animate-in slide-in-from-top-2">
                      <button className="w-full text-left px-4 py-2 text-sm hover:bg-gray-50 text-gray-700 font-medium border-b" onClick={() => {
                          setIsHeaderMenuOpen(false);
                          setIsInfoOpen(true);
                      }}>
                          Contact info
                      </button>
                      {chat?.type === 'group' && (
                          <button className="w-full text-left px-4 py-2 text-sm hover:bg-gray-50 text-gray-700" onClick={() => {
                              setIsHeaderMenuOpen(false);
                              setIsGroupManageOpen(true);
                          }}>
                              Add member
                          </button>
                      )}
                    <button className="w-full text-left px-4 py-2 text-sm hover:bg-gray-50 text-gray-700" onClick={() => {
                        setIsHeaderMenuOpen(false);
                        handleUserPreference('pinnedChats', selectedChatId, isPinned);
                    }}>
                        {isPinned ? 'Unpin chat' : 'Pin chat'}
                    </button>
                    <button className="w-full text-left px-4 py-2 text-sm hover:bg-gray-50 text-gray-700" onClick={() => {
                        setIsHeaderMenuOpen(false);
                        handleUserPreference('archivedChats', selectedChatId, isArchived);
                    }}>
                        {isArchived ? 'Unarchive chat' : 'Archive chat'}
                    </button>
                    <button className="w-full text-left px-4 py-2 text-sm hover:bg-gray-50 text-gray-700" onClick={() => {
                        setIsHeaderMenuOpen(false);
                        handleUserPreference('lockedChats', selectedChatId, isLocked);
                    }}>
                        {isLocked ? 'Unlock chat' : 'Lock chat'}
                    </button>
                    <button className="w-full text-left px-4 py-2 text-sm hover:bg-gray-50 text-gray-700" onClick={() => {
                        setIsHeaderMenuOpen(false);
                        setShowExportModal(true);
                    }}>
                        Export chat
                    </button>
                    {chat?.type === 'direct' && otherUser && (
                        <button className="w-full text-left px-4 py-2 text-sm hover:bg-gray-50 text-red-600" onClick={() => {
                            setIsHeaderMenuOpen(false);
                            handleUserPreference('blockedUsers', otherUser.id, isBlocked);
                        }}>
                            {isBlocked ? 'Unblock user' : 'Block user'}
                        </button>
                    )}
                    <button className="w-full text-left px-4 py-2 text-sm hover:bg-gray-50 text-red-600" onClick={async () => {
                         setIsHeaderMenuOpen(false);
                         if (!currentUser || !selectedChatId || !chat) return;
                         try {
                              const updatedParticipants = chat.participants.filter(p => p !== currentUser.uid);
                              if (updatedParticipants.length === 0) {
                                  await updateDoc(doc(db, 'chats', selectedChatId), {
                                      participants: []
                                  });
                              } else {
                                  await updateDoc(doc(db, 'chats', selectedChatId), {
                                      participants: updatedParticipants
                                  });
                              }
                              setSelectedChatId(null);
                         } catch (e) {
                              console.error(e);
                         }
                    }}>
                        {chat?.type === 'direct' ? 'Delete chat' : 'Leave group'}
                    </button>
                </div>
             )}
          </div>
        </div>
      </header>

      {/* Messages Area */}
      <div className="flex-1 bg-[#efeae2] relative overflow-hidden flex flex-col">
        {/* Overlay pattern */}
        <div className="absolute inset-0 opacity-[0.06] pointer-events-none" style={{backgroundImage: 'url("https://www.transparenttextures.com/patterns/cubes.png")'}}></div>
        
        <div className="p-4 md:p-10 flex flex-col space-y-3 h-full overflow-y-auto relative z-0">
          <div className="self-center bg-[#d9fdd3] text-[12.5px] px-3 py-1.5 rounded-lg shadow-sm text-[#54656f] uppercase tracking-wide mb-2">Today</div>
          
          {messages.map((msg, idx) => {
            const isMine = msg.senderId === currentUser?.uid;
            const showTail = idx === messages.length - 1 || messages[idx + 1]?.senderId !== msg.senderId;

            return (
              <div key={msg.id} className={`flex ${isMine ? 'justify-end' : 'justify-start'}`}>
                <div 
                  className={`max-w-[75%] md:max-w-[65%] p-2 shadow-sm relative
                    ${isMine ? 'bg-[#d9fdd3] text-[#111b21]' : 'bg-white text-[#111b21]'}
                    ${showTail ? (isMine ? 'rounded-lg rounded-tr-none' : 'rounded-lg rounded-tl-none') : 'rounded-lg'}
                  `}
                  onContextMenu={(e) => {
                    e.preventDefault();
                    setContextMenu({ x: e.clientX, y: e.clientY, msgId: msg.id });
                  }}
                >
                  {!isMine && chat.type === 'group' && (
                    <div className="text-[13px] font-medium mb-1 text-emerald-600">
                      {users.find(u => u.id === msg.senderId)?.displayName || 'Unknown'}
                    </div>
                  )}
                  {msg.replyToId && (() => {
                     const repliedMsg = messages.find(m => m.id === msg.replyToId);
                     return repliedMsg ? (
                        <div className="bg-black/5 hover:bg-black/10 transition-colors p-2 rounded mb-2 border-l-4 border-emerald-500 cursor-pointer text-sm">
                            <div className="font-semibold text-emerald-600 mb-0.5">
                                {users.find(u => u.id === repliedMsg.senderId)?.displayName || 'Unknown'}
                            </div>
                            <div className="text-gray-600 truncate max-w-[200px]">
                                {repliedMsg.text}
                            </div>
                        </div>
                     ) : null;
                  })()}
                  <div className="pr-12 text-[14.2px] leading-relaxed whitespace-pre-wrap break-words format-text">
                    {msg.mediaUrl && msg.mediaType === 'image' && (
                      <img src={msg.mediaUrl} alt="uploaded content" className="w-full max-w-[250px] rounded-md mb-2" />
                    )}
                    {msg.mediaUrl && msg.mediaType === 'video' && (
                      <video src={msg.mediaUrl} controls className="w-full max-w-[250px] rounded-md mb-2"></video>
                    )}
                    {msg.mediaUrl && msg.mediaType === 'audio' && (
                      <div className="mb-2">
                        <AudioPlayer src={msg.mediaUrl} />
                      </div>
                    )}
                    {msg.mediaType === 'location' && msg.location && (
                      <div className="mb-2">
                        <a href={`https://www.google.com/maps?q=${msg.location.latitude},${msg.location.longitude}`} target="_blank" rel="noopener noreferrer" className="block w-full max-w-[250px] bg-[#e6efeb] rounded-lg p-4 flex flex-col items-center justify-center text-[#00a884] shadow-sm">
                            <MapPin size={32} className="mb-2 text-red-500" />
                            <span className="font-medium text-sm">View Location</span>
                        </a>
                      </div>
                    )}
                    {msg.text !== 'Sent media' && msg.text !== 'Sent voice message' && msg.text !== 'Shared a location' && renderMessageText(msg.text)}
                  </div>
                  {msg.reactions && Object.keys(msg.reactions).length > 0 && (
                      <div className="absolute -bottom-3 left-2 bg-white border border-gray-200 rounded-full px-1.5 py-0.5 text-xs shadow-sm flex items-center space-x-1 cursor-pointer hover:bg-gray-50 max-w-[150px] truncate" title={Object.values(msg.reactions).join(', ')}>
                          {Array.from(new Set(Object.values(msg.reactions))).map((emoji, i) => (
                              <span key={i}>{emoji}</span>
                          ))}
                          <span className="text-gray-500 ml-1">{Object.keys(msg.reactions).length > 1 ? Object.keys(msg.reactions).length : ''}</span>
                      </div>
                  )}
                  {contextMenu?.msgId === msg.id && msg.text !== 'This message was deleted' && (
                    <div 
                      className="absolute bg-white shadow-xl rounded-lg z-50 p-2 min-w-[150px]"
                      style={{ top: '100%', left: 0 }}
                      onClick={(e) => {
                          // Prevent clicks inside the menu from propagating unless handled
                          e.stopPropagation();
                      }}
                    >
                      <div className="flex gap-2 p-2 border-b border-gray-100 mb-1 justify-center">
                          {['👍', '❤️', '😂', '😮', '😢', '🔥'].map(emoji => (
                              <button key={emoji} onClick={() => handleReaction(msg.id, emoji)} className="text-xl hover:scale-125 transition-transform">{emoji}</button>
                          ))}
                      </div>
                      <button className="block w-full text-left p-2 hover:bg-gray-100" onClick={() => { navigator.clipboard.writeText(msg.text); setContextMenu(null); }}>Copy</button>
                      <button className="block w-full text-left p-2 hover:bg-gray-100" onClick={() => { handleSpeak(msg.text); setContextMenu(null); }}>Speak</button>
                      <button className="block w-full text-left p-2 hover:bg-gray-100" onClick={() => { handleReply(msg); setContextMenu(null); }}>Reply</button>
                      {isMine && <button className="block w-full text-left p-2 hover:bg-gray-100" onClick={() => { handleEdit(msg); setContextMenu(null); }}>Edit</button>}
                      {isMine && <button className="block w-full text-left p-2 hover:bg-gray-100 text-red-500" onClick={() => { handleDelete(msg.id); setContextMenu(null); }}>Delete</button>}
                    </div>
                  )}
                  <div className="absolute right-2 bottom-1 flex items-center">
                    <span className="text-[11px] text-[#667781] mr-1">
                      {msg.createdAt && format(msg.createdAt?.toDate() || new Date(), 'HH:mm')}
                    </span>
                    {isMine && (
                      <svg viewBox="0 0 16 15" className="w-[15px] h-[15px] fill-current text-[#53bdeb]">
                        <path d="M15.01 3.316l-.478-.372a.365.365 0 0 0-.51.063L8.666 9.879a.32.32 0 0 1-.484.033l-.358-.325a.32.32 0 0 0-.484.032l-.378.483a.418.418 0 0 0 .036.541l1.32 1.266c.143.14.361.125.484-.033l6.272-8.048a.366.366 0 0 0-.064-.512zm-4.1 0l-.478-.372a.365.365 0 0 0-.51.063L4.566 9.879a.32.32 0 0 1-.484.033L1.891 7.769a.366.366 0 0 0-.515.006l-.423.433a.364.364 0 0 0 .006.514l3.258 3.185c.143.14.361.125.484-.033l6.272-8.048a.365.365 0 0 0-.063-.51z" />
                      </svg>
                    )}
                  </div>
                </div>
              </div>
            );
          })}
          <div ref={messagesEndRef} />
        </div>
      </div>

      {/* Input Area */}
      {isLocked ? (
        <footer className="min-h-[62px] bg-[#f0f2f5] flex items-center justify-center px-4 py-2 border-t border-[#d1d7db]">
            <div className="text-[#54656f] flex flex-col items-center">
                <span className="mb-2">This chat is locked.</span>
                <button onClick={() => handleUserPreference('lockedChats', selectedChatId, true)} className="bg-[#00a884] text-white px-4 py-2 rounded text-sm font-medium hover:bg-[#008f6f]">Unlock Chat</button>
            </div>
        </footer>
      ) : isBlocked ? (
        <footer className="min-h-[62px] bg-[#f0f2f5] flex items-center justify-center px-4 py-2 border-t border-[#d1d7db]">
            <div className="text-[#54656f] flex flex-col items-center">
                <span>You blocked this contact.</span>
                <button onClick={() => handleUserPreference('blockedUsers', otherUser!.id, true)} className="text-[#00a884] mt-1 hover:underline text-sm font-medium">Tap to unblock</button>
            </div>
        </footer>
      ) : (
        <>
          {replyingTo && (
            <div className="bg-[#f0f2f5] px-4 pt-2 w-full relative">
              <div className="bg-black/5 p-3 rounded-t-lg border-l-4 border-emerald-500 relative flex items-start">
                 <div className="flex-1">
                     <div className="text-emerald-600 font-semibold text-sm mb-1">
                         {users.find(u => u.id === replyingTo.senderId)?.displayName || 'Unknown'}
                     </div>
                     <div className="text-gray-600 text-sm truncate max-w-sm">
                         {replyingTo.text}
                     </div>
                 </div>
                 <button onClick={() => setReplyingTo(null)} className="text-gray-500 hover:text-gray-800 p-1 rounded-full hover:bg-black/5 transition-colors">
                     <X size={18} />
                 </button>
              </div>
            </div>
          )}
          <footer className={`min-h-[62px] bg-[#f0f2f5] flex items-center px-4 py-2 space-x-4 border-t border-[#d1d7db] ${replyingTo ? 'border-t-0 pt-0' : ''}`}>
            <div className="flex space-x-3 text-[#54656f] relative">
          <button className="hover:text-[#111b21] transition-colors flex items-center justify-center p-1">
            <Smile className="w-[26px] h-[26px]" />
          </button>
          
          <div className="relative">
             <button 
              className="relative hover:text-[#111b21] transition-colors flex items-center justify-center p-1"
              disabled={isUploading}
              style={{opacity: isUploading ? 0.5 : 1}}
              onClick={() => setIsAttachmentMenuOpen(!isAttachmentMenuOpen)}
             >
               <Paperclip className="w-[26px] h-[26px]" />
             </button>
             {isAttachmentMenuOpen && (
                 <div className="absolute bottom-12 left-0 bg-white rounded-2xl shadow-[0_2px_15px_rgba(11,20,26,0.1)] p-4 flex flex-col gap-4 z-50 animate-in slide-in-from-bottom-2 w-[250px]">
                     <div className="grid grid-cols-3 gap-y-6 gap-x-2">
                         <button className="flex flex-col items-center gap-2 group" onClick={() => { setIsAttachmentMenuOpen(false); if (fileInputRef.current) { fileInputRef.current.accept = ".pdf,.doc,.docx,.txt"; fileInputRef.current.click(); }}}>
                             <div className="w-[50px] h-[50px] rounded-full bg-[#7f66ff] text-white flex items-center justify-center group-hover:scale-105 transition-transform shadow-sm"><FileText size={24} /></div>
                             <span className="text-[13px] text-[#54656f]">Document</span>
                         </button>
                         <button className="flex flex-col items-center gap-2 group relative" onClick={() => { setIsAttachmentMenuOpen(false); }}>
                             <div className="w-[50px] h-[50px] rounded-full bg-[#007bfc] text-white flex items-center justify-center group-hover:scale-105 transition-transform shadow-sm"><ImageIcon size={24} /></div>
                             <span className="text-[13px] text-[#54656f]">Photos</span>
                             <input type="file" ref={fileInputRef} onChange={(e) => { handleFileUpload(e); setIsAttachmentMenuOpen(false); }} accept="image/*,video/*,audio/*" className="absolute inset-0 opacity-0 cursor-pointer" />
                         </button>
                         <button className="flex flex-col items-center gap-2 group" onClick={() => { setIsAttachmentMenuOpen(false); cameraInputRef.current?.click(); }}>
                             <div className="w-[50px] h-[50px] rounded-full bg-[#ff2e74] text-white flex items-center justify-center group-hover:scale-105 transition-transform shadow-sm"><Camera size={24} /></div>
                             <span className="text-[13px] text-[#54656f]">Camera</span>
                         </button>
                         <button className="flex flex-col items-center gap-2 group" onClick={() => { 
                             setIsAttachmentMenuOpen(false); 
                             if (navigator.geolocation) {
                                 navigator.geolocation.getCurrentPosition(
                                     async (position) => {
                                         const { latitude, longitude } = position.coords;
                                         if (!currentUser || !selectedChatId) return;
                                         try {
                                             const messageCol = collection(db, `chats/${selectedChatId}/messages`);
                                             await addDoc(messageCol, {
                                               text: `Shared a location`,
                                               senderId: currentUser.uid,
                                               createdAt: serverTimestamp(),
                                               status: 'sent',
                                               mediaType: 'location',
                                               location: { latitude, longitude }
                                             });
                                             await updateDoc(doc(db, 'chats', selectedChatId), {
                                               lastMessage: '📍 Location',
                                               updatedAt: serverTimestamp()
                                             });
                                         } catch (e) {
                                            console.error('Error sending location:', e);
                                         }
                                     },
                                     (error) => {
                                         alert('Error getting location: ' + error.message);
                                     }
                                 );
                             } else {
                                 alert('Geolocation is not supported by this browser.');
                             }
                         }}>
                             <div className="w-[50px] h-[50px] rounded-full bg-[#08a652] text-white flex items-center justify-center group-hover:scale-105 transition-transform shadow-sm"><MapPin size={24} /></div>
                             <span className="text-[13px] text-[#54656f]">Location</span>
                         </button>
                         <button className="flex flex-col items-center gap-2 group" onClick={() => { setIsAttachmentMenuOpen(false); alert('Poll not implemented yet'); }}>
                             <div className="w-[50px] h-[50px] rounded-full bg-[#ffbc38] text-white flex items-center justify-center group-hover:scale-105 transition-transform shadow-sm"><BarChart2 size={24} /></div>
                             <span className="text-[13px] text-[#54656f]">Poll</span>
                         </button>
                         <button className="flex flex-col items-center gap-2 group" onClick={() => { setIsAttachmentMenuOpen(false); alert('Event not implemented yet'); }}>
                             <div className="w-[50px] h-[50px] rounded-full bg-[#0fbaf2] text-white flex items-center justify-center group-hover:scale-105 transition-transform shadow-sm"><Calendar size={24} /></div>
                             <span className="text-[13px] text-[#54656f]">Event</span>
                         </button>
                     </div>
                 </div>
             )}
          </div>
        </div>
        
        <div className="flex-1 bg-white rounded-lg shadow-sm flex items-center min-h-[42px] px-4 py-2 text-sm">
           <input type="file" ref={cameraInputRef} onChange={(e) => { handleFileUpload(e); setIsAttachmentMenuOpen(false); }} accept="image/*" capture="environment" className="hidden" />
           <textarea
            value={inputText}
            onChange={e => handleTyping(e.target.value)}
            onKeyDown={handleKeyPress}
            placeholder="Type a message"
            className="w-full bg-transparent border-none outline-none text-[#111b21] placeholder-[#667781] resize-none max-h-32"
            rows={1}
            style={{
               overflowY: inputText.split('\n').length > 1 ? 'auto' : 'hidden'
            }}
           />
        </div>

        <div className="flex items-center justify-center text-[#54656f]">
          {inputText.trim() ? (
            <button onClick={handleSend} className="hover:text-[#111b21] transition-colors p-1">
              <Send className="w-[26px] h-[26px]" />
            </button>
          ) : isRecording ? (
            <button onClick={stopRecording} className="text-red-500 hover:text-red-600 transition-colors p-1 flex items-center group relative">
              <div className="absolute -top-10 right-0 bg-white shadow-md rounded-full px-3 py-1 flex items-center space-x-2 animate-pulse whitespace-nowrap">
                  <div className="w-2 h-2 rounded-full bg-red-500"></div>
                  <span className="text-sm font-medium">Recording</span>
              </div>
              <div className="w-[40px] h-[40px] rounded-full bg-red-500 text-white flex items-center justify-center shadow-lg transform active:scale-95 transition-all">
                <Send className="w-[20px] h-[20px]" />
              </div>
            </button>
          ) : (
             <button onClick={startRecording} className="hover:text-[#111b21] transition-colors p-1">
              <Mic className="w-[26px] h-[26px]" />
            </button>
          )}
        </div>
      </footer>
      </>
      )}

      {/* Export Modal */}
      {showExportModal && (
         <div className="absolute inset-0 bg-black/50 z-[100] flex items-center justify-center p-4">
             <div className="bg-white rounded-lg shadow-xl w-full max-w-sm p-6 animate-in zoom-in-95">
                 <h2 className="text-xl font-medium text-[#111b21] mb-2">Export Chat</h2>
                 <p className="text-sm text-[#54656f] mb-6">Attaching media will increase the size of the chat export.</p>
                 <div className="flex flex-col gap-3">
                     <button className="w-full text-[#00a884] font-medium py-3 rounded hover:bg-[#f0f2f5] transition-colors" onClick={() => { setExportWithMedia(false); handleExportChat(); }}>
                         Without Media
                     </button>
                     <button className="w-full text-[#00a884] font-medium py-3 rounded hover:bg-[#f0f2f5] transition-colors" onClick={() => { setExportWithMedia(true); handleExportChat(); }}>
                         Include Media
                     </button>
                     <button className="w-full text-[#111b21] py-3 rounded hover:bg-gray-100 transition-colors mt-2" onClick={() => setShowExportModal(false)}>
                         Cancel
                     </button>
                 </div>
             </div>
         </div>
      )}

      {isGroupManageOpen && chat?.type === 'group' && selectedChatId && (
          <AddMemberModal 
              chatId={selectedChatId} 
              currentParticipants={chat.participants} 
              onClose={() => setIsGroupManageOpen(false)} 
          />
      )}
      </div>

      {/* Info Sidebar */}
      {isInfoOpen && (
          <div className="w-[400px] border-l border-[#d1d7db] bg-[#f0f2f5] flex flex-col h-full animate-in slide-in-from-right duration-300">
              <div className="h-[60px] bg-[#f0f2f5] px-4 flex items-center border-b border-[#d1d7db]">
                  <button onClick={() => setIsInfoOpen(false)} className="mr-6 text-[#54656f]">
                      <X className="w-6 h-6" />
                  </button>
                  <h3 className="text-base text-[#111b21] font-medium">Contact info</h3>
              </div>
              
              <div className="flex-1 overflow-y-auto">
                  <div className="bg-white flex flex-col items-center py-7 px-4 shadow-sm mb-2">
                       {otherUser?.photoURL ? (
                          <img src={otherUser.photoURL} alt="" className="w-48 h-48 rounded-full mb-4 shadow-sm" />
                       ) : (
                          <div className="w-48 h-48 rounded-full bg-emerald-500 flex items-center justify-center text-white text-5xl font-bold mb-4">
                              {chatName.substring(0, 1).toUpperCase()}
                          </div>
                       )}
                       <h2 className="text-2xl text-[#111b21] mb-1">{chatName}</h2>
                       <div className="text-[#667781] text-sm">
                           {otherUser?.phoneNumber || otherUser?.email}
                       </div>
                  </div>

                  <div className="bg-white p-4 shadow-sm mb-2">
                      <div className="text-[14px] text-[#667781] mb-1">About</div>
                      <div className="text-[17px] text-[#111b21]">Hey there! I am using WhatsApp.</div>
                  </div>

                  {otherUser?.phoneNumber && (
                      <div className="bg-white p-4 shadow-sm mb-2">
                          <div className="text-[14px] text-[#667781] mb-1">Phone number</div>
                          <div className="text-[17px] text-[#111b21]">{otherUser.phoneNumber}</div>
                      </div>
                  )}

                  <div className="bg-white shadow-sm mb-2">
                      <button className="w-full flex items-center gap-4 px-4 py-4 hover:bg-[#f0f2f5] text-red-500 font-medium transition-colors" onClick={() => handleUserPreference('blockedUsers', otherUser!.id, isBlocked)}>
                          {isBlocked ? 'Unblock user' : 'Block user'}
                      </button>
                      <button className="w-full flex items-center gap-4 px-4 py-4 hover:bg-[#f0f2f5] text-red-500 font-medium transition-colors border-t border-gray-50">
                          Report user
                      </button>
                  </div>
              </div>
          </div>
      )}
    </div>
  );
}
