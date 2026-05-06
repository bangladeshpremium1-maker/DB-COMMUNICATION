import React, { useState } from 'react';
import { X, Search } from 'lucide-react';
import { db } from '../lib/firebase';
import { collection, addDoc, serverTimestamp } from 'firebase/firestore';

interface NewGroupModalProps {
  onClose: () => void;
  currentUser: any;
  users: any[];
}

export function NewGroupModal({ onClose, currentUser, users }: NewGroupModalProps) {
  const [groupName, setGroupName] = useState('');
  const [selectedUsers, setSelectedUsers] = useState<string[]>([]);
  const [searchTerm, setSearchTerm] = useState('');

  const filteredUsers = users.filter(u => u.id !== currentUser?.uid && 
                                       (u.displayName?.toLowerCase().includes(searchTerm.toLowerCase()) || 
                                        u.email?.toLowerCase().includes(searchTerm.toLowerCase())));

  const createGroup = async () => {
    if (!groupName || selectedUsers.length === 0) return;
    
    try {
      await addDoc(collection(db, 'chats'), {
        type: 'group',
        name: groupName,
        participants: [currentUser.uid, ...selectedUsers],
        updatedAt: serverTimestamp(),
        lastMessage: 'Group created'
      });
      onClose();
    } catch (e) {
      console.error(e);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/50 z-[100] flex items-center justify-center p-4">
      <div className="bg-white rounded-xl shadow-xl w-full max-w-md p-6">
        <div className="flex justify-between items-center mb-4">
          <h2 className="text-xl font-bold">New Group</h2>
          <button onClick={onClose}><X size={20}/></button>
        </div>
        
        <input 
          type="text" 
          placeholder="Group Name" 
          value={groupName}
          onChange={e => setGroupName(e.target.value)}
          className="w-full p-2 border rounded mb-4"
        />

        <div className="relative mb-4">
          <Search size={18} className="absolute left-3 top-3 text-gray-400" />
          <input 
            type="text" 
            placeholder="Search users..." 
            value={searchTerm}
            onChange={e => setSearchTerm(e.target.value)}
            className="w-full pl-10 p-2 border rounded"
          />
        </div>

        <div className="max-h-60 overflow-y-auto mb-4">
          {filteredUsers.map(user => (
            <div key={user.id} className="flex items-center justify-between p-2 hover:bg-gray-50 cursor-pointer" onClick={() => {
                if (selectedUsers.includes(user.id)) {
                  setSelectedUsers(selectedUsers.filter(id => id !== user.id));
                } else {
                  setSelectedUsers([...selectedUsers, user.id]);
                }
            }}>
              <span>{user.displayName}</span>
              <input type="checkbox" checked={selectedUsers.includes(user.id)} readOnly/>
            </div>
          ))}
        </div>

        <button 
            onClick={createGroup}
            disabled={!groupName || selectedUsers.length === 0}
            className="w-full bg-emerald-600 text-white py-2 rounded-lg disabled:bg-gray-300"
        >
            Create Group
        </button>
      </div>
    </div>
  );
}
