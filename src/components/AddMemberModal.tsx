import React, { useState } from 'react';
import { X, Search } from 'lucide-react';
import { db } from '../lib/firebase';
import { doc, updateDoc } from 'firebase/firestore';
import { useUsers } from '../hooks/useFirebase';

interface AddMemberModalProps {
  chatId: string;
  currentParticipants: string[];
  onClose: () => void;
}

export function AddMemberModal({ chatId, currentParticipants, onClose }: AddMemberModalProps) {
  const users = useUsers();
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedUsers, setSelectedUsers] = useState<string[]>([]);

  // Filter out existing participants
  const availableUsers = users.filter(
    (u) => !currentParticipants.includes(u.uid) && !currentParticipants.includes(u.id)
  );

  const filteredUsers = availableUsers.filter((u) => {
    const q = searchQuery.toLowerCase();
    return u.displayName?.toLowerCase().includes(q) || u.email?.toLowerCase().includes(q);
  });

  const toggleUser = (userId: string) => {
    setSelectedUsers(prev => 
      prev.includes(userId) ? prev.filter(id => id !== userId) : [...prev, userId]
    );
  };

  const handleAddMembers = async () => {
    if (selectedUsers.length === 0) return;
    
    try {
      const updatedParticipants = [...currentParticipants, ...selectedUsers];
      await updateDoc(doc(db, 'chats', chatId), {
        participants: updatedParticipants
      });
      onClose();
    } catch (e) {
      console.error('Error adding members to group:', e);
      alert('Failed to add members. Check permissions.');
    }
  };

  return (
    <div className="absolute inset-x-0 top-0 h-full bg-[#f0f2f5] z-50 flex flex-col animate-in slide-in-from-right duration-200">
      <div className="h-[100px] bg-[#008069] flex flex-col justify-end px-4 pb-4 flex-shrink-0">
        <div className="flex items-center text-white">
          <button onClick={onClose} className="mr-6">
            <X className="w-6 h-6" />
          </button>
          <h2 className="text-xl font-medium">Add members</h2>
        </div>
      </div>
      
      <div className="p-4 bg-white border-b border-gray-200">
        <div className="bg-[#f0f2f5] rounded-lg flex items-center px-4 py-2">
          <Search className="w-5 h-5 text-[#54656f] mr-4" />
          <input
            type="text"
            placeholder="Search contacts"
            className="bg-transparent border-none outline-none w-full text-sm text-[#111b21] placeholder-[#667781]"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
          />
        </div>
      </div>

      <div className="flex-1 overflow-y-auto">
        {selectedUsers.length > 0 && (
            <div className="p-4 flex gap-2 overflow-x-auto flex-nowrap bg-white border-b border-gray-100">
                {selectedUsers.map(id => {
                    const u = users.find(x => x.id === id || x.uid === id);
                    return (
                        <div key={id} className="flex items-center gap-1 bg-gray-100 rounded-full px-3 py-1 flex-shrink-0">
                            {u?.photoURL ? (
                                <img src={u.photoURL} alt="" className="w-6 h-6 rounded-full object-cover" />
                            ) : (
                                <div className="w-6 h-6 rounded-full bg-[#00a884] flex items-center justify-center text-white text-xs">
                                    {u?.displayName?.charAt(0).toUpperCase()}
                                </div>
                            )}
                            <span className="text-sm truncate max-w-[80px]">{u?.displayName}</span>
                            <button onClick={() => toggleUser(id)} className="text-gray-500 hover:text-gray-800 ml-1">
                                <X className="w-4 h-4" />
                            </button>
                        </div>
                    );
                })}
            </div>
        )}
        
        <div className="py-2">
            <div className="px-4 text-[#008069] text-sm font-medium mb-3 uppercase tracking-wider">Contacts on WhatsApp</div>
            {filteredUsers.length === 0 ? (
                <div className="text-center p-8 text-[#54656f] text-sm">No contacts found</div>
            ) : (
                filteredUsers.map((user) => (
                    <div 
                        key={user.uid} 
                        className="flex items-center px-4 py-3 cursor-pointer hover:bg-[#f5f6f6] transition-colors gap-4"
                        onClick={() => toggleUser(user.uid || user.id)}
                    >
                        <div className="w-12 h-12 rounded-full overflow-hidden flex-shrink-0 bg-gray-200">
                          {user.photoURL ? (
                            <img src={user.photoURL} alt={user.displayName} className="w-full h-full object-cover" />
                          ) : (
                            <div className="w-full h-full bg-[#dfe5e7] flex items-center justify-center text-gray-500">
                              <span className="text-lg font-bold">{user.displayName?.charAt(0).toUpperCase()}</span>
                            </div>
                          )}
                        </div>
                        <div className="flex-1 min-w-0 border-b border-[#f0f2f5] pb-3">
                          <h3 className="text-[17px] text-[#111b21] truncate">{user.displayName}</h3>
                          <p className="text-sm text-[#54656f] truncate">{user.statusMessage || 'Available'}</p>
                        </div>
                        <div className="pl-3 pb-3 border-b border-[#f0f2f5] h-full flex items-center">
                            <div className={`w-6 h-6 rounded border flex items-center justify-center transition-colors ${selectedUsers.includes(user.uid || user.id) ? 'bg-[#00a884] border-[#00a884]' : 'border-gray-300'}`}>
                                {selectedUsers.includes(user.uid || user.id) && <svg viewBox="0 0 24 24" fill="none" className="w-4 h-4 text-white"><path d="M5 12l5 5 10-10" fill="currentColor" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/></svg>}
                            </div>
                        </div>
                    </div>
                ))
            )}
        </div>
      </div>
      
      {selectedUsers.length > 0 && (
          <div className="p-4 bg-[#f0f2f5] flex justify-center transform -translate-y-6">
              <button 
                onClick={handleAddMembers}
                className="w-14 h-14 bg-[#00a884] rounded-full flex items-center justify-center text-white shadow-lg hover:bg-[#008f6f] transition-colors"
                title="Add members"
              >
                 <svg viewBox="0 0 24 24" width="24" height="24" fill="currentColor"><path d="M9 16.2L4.8 12l-1.4 1.4L9 19 21 7l-1.4-1.4L9 16.2z"></path></svg>
              </button>
          </div>
      )}
    </div>
  );
}
