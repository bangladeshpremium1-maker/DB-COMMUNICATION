import { Phone, X } from 'lucide-react';
import { callService } from '../services/callService';

export function IncomingCallOverlay({ call, onAccept, onReject }: { call: any, onAccept: (callId: string) => void, onReject: (callId: string) => void }) {
  return (
    <div className="absolute top-4 left-0 right-0 mx-4 z-50 bg-white p-4 rounded-lg shadow-2xl flex items-center justify-between animate-in slide-in-from-top">
      <div>
        <h3 className="font-semibold text-lg animate-pulse">Incoming {call.type} call...</h3>
        <p className="text-gray-500">From {call.callerId}</p>
      </div>
      <div className="flex gap-4">
        <button onClick={() => onReject(call.id)} className="p-3 bg-red-500 text-white rounded-full hover:bg-red-600">
          <X className="w-6 h-6" />
        </button>
        <button onClick={() => onAccept(call.id)} className="p-3 bg-green-500 text-white rounded-full hover:bg-green-600">
          <Phone className="w-6 h-6" />
        </button>
      </div>
    </div>
  );
}
