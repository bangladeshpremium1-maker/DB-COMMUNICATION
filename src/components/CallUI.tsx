import { Phone, Video, Mic, MicOff, VideoOff, X, Wifi, Monitor } from 'lucide-react';
import { useState, useRef, useEffect } from 'react';

export function CallUI({ callId, type, onEnd }: { callId: string, type: 'voice' | 'video', onEnd: () => void }) {
  const [isMuted, setIsMuted] = useState(false);
  const [isVideoOff, setIsVideoOff] = useState(false);
  const [isScreenSharing, setIsScreenSharing] = useState(false);
  const [connectionState, setConnectionState] = useState<'connecting' | 'connected' | 'disconnected'>('connecting');
  const [volume, setVolume] = useState(0);
  const videoRef = useRef<HTMLVideoElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const cameraStreamRef = useRef<MediaStream | null>(null); // Store original camera stream
  const audioContextRef = useRef<AudioContext | null>(null);
  const analyserRef = useRef<AnalyserNode | null>(null);

  useEffect(() => {
    if (connectionState !== 'connecting') return;
    // Simulate connection
    const timer = setTimeout(() => setConnectionState('connected'), 2000);
    return () => clearTimeout(timer);
  }, [connectionState]);

  useEffect(() => {
    if (streamRef.current) {
        streamRef.current.getAudioTracks().forEach(track => track.enabled = !isMuted);
    }
  }, [isMuted]);

  useEffect(() => {
    if (streamRef.current && !isScreenSharing) {
        streamRef.current.getVideoTracks().forEach(track => track.enabled = !isVideoOff);
    }
  }, [isVideoOff, isScreenSharing]);

  useEffect(() => {
    async function setupStream() {
      try {
        const stream = await navigator.mediaDevices.getUserMedia({
          audio: true,
          video: type === 'video',
        });
        streamRef.current = stream;
        cameraStreamRef.current = stream; // Keep original
        if (videoRef.current) {
          videoRef.current.srcObject = stream;
        }

        // Setup audio analysis
        const audioContext = new AudioContext();
        const analyser = audioContext.createAnalyser();
        const source = audioContext.createMediaStreamSource(stream);
        source.connect(analyser);
        analyser.fftSize = 256;
        
        audioContextRef.current = audioContext;
        analyserRef.current = analyser;

        const dataArray = new Uint8Array(analyser.frequencyBinCount);
        
        function updateVolume() {
          analyser.getByteFrequencyData(dataArray);
          let sum = 0;
          for (let i = 0; i < dataArray.length; i++) {
            sum += dataArray[i];
          }
          const average = sum / dataArray.length;
          setVolume(Math.min(100, Math.floor(average * 2))); // Scale to 0-100
          requestAnimationFrame(updateVolume);
        }
        updateVolume();
      } catch (err) {
        console.error("Error accessing media devices:", err);
      }
    }
    setupStream();
    return () => {
      streamRef.current?.getTracks().forEach((track) => track.stop());
      audioContextRef.current?.close();
    };
  }, [type]);

  const toggleScreenSharing = async () => {
    if (!isScreenSharing) {
        try {
            const screenStream = await navigator.mediaDevices.getDisplayMedia({ video: true });
            const screenTrack = screenStream.getVideoTracks()[0];
            
            if (streamRef.current && cameraStreamRef.current) {
                const videoTrack = cameraStreamRef.current.getVideoTracks()[0];
                streamRef.current.removeTrack(videoTrack);
                streamRef.current.addTrack(screenTrack);
                if (videoRef.current) {
                    videoRef.current.srcObject = streamRef.current;
                }
                
                // Handle when user stops sharing via browser button
                screenTrack.onended = () => {
                    stopScreenSharing();
                };
                
                setIsScreenSharing(true);
            }
        } catch (err) {
            console.error("Error starting screen sharing:", err);
        }
    } else {
        stopScreenSharing();
    }
  };

  const stopScreenSharing = () => {
      if (streamRef.current && cameraStreamRef.current) {
          const screenTrack = streamRef.current.getVideoTracks()[0];
          screenTrack.stop();
          streamRef.current.removeTrack(screenTrack);
          
          const videoTrack = cameraStreamRef.current.getVideoTracks()[0];
          streamRef.current.addTrack(videoTrack);
          
          if (videoRef.current) {
              videoRef.current.srcObject = streamRef.current;
          }
          
          videoTrack.enabled = !isVideoOff;
          setIsScreenSharing(false);
      }
  };

  return (
    <div className="absolute inset-0 bg-gray-900 z-50 flex flex-col items-center justify-between p-8 text-white">
      <div className="text-center mt-10 w-full relative">
        <h2 className="text-2xl font-semibold">{type === 'voice' ? 'Voice Call' : 'Video Call'}</h2>
        <p className="text-gray-400 capitalize">{connectionState}</p>
        {connectionState === 'disconnected' && (
           <button onClick={() => setConnectionState('connecting')} className="mt-2 bg-white text-gray-900 px-4 py-1 rounded-full text-xs font-semibold hover:bg-gray-200">Retry</button>
        )}
        <div className="absolute right-0 top-0 flex items-center gap-1 text-green-400">
           <Wifi size={20} />
           <div className="text-xs font-mono">{volume > 10 ? 'High' : 'Low'}</div>
        </div>
      </div>

      <div className="flex-1 w-full flex items-center justify-center">
         {type === 'video' && (
           <div className="w-full h-80 bg-gray-800 rounded-xl flex items-center justify-center overflow-hidden">
             {isVideoOff && !isScreenSharing ? <VideoOff size={48} /> : <video ref={videoRef} autoPlay playsInline muted className="w-full h-full object-cover" />}
           </div>
         )}
         {type === 'voice' && <div className={`text-8xl transition-transform duration-75 ${volume > 20 ? 'scale-110' : 'scale-100'}`}>👤</div>}
      </div>

      <div className="flex gap-6 mb-10">
        <button onClick={() => setIsMuted(!isMuted)} className={`p-4 rounded-full ${isMuted ? 'bg-red-500' : 'bg-gray-700'}`}>
          {isMuted ? <MicOff /> : <Mic />}
        </button>
        {type === 'video' && (
          <>
          <button onClick={() => setIsVideoOff(!isVideoOff)} className={`p-4 rounded-full ${isVideoOff ? 'bg-red-500' : 'bg-gray-700'}`}>
            {isVideoOff ? <VideoOff /> : <Video />}
          </button>
          <button onClick={toggleScreenSharing} className={`p-4 rounded-full ${isScreenSharing ? 'bg-green-500' : 'bg-gray-700'}`}>
            <Monitor />
          </button>
          </>
        )}
        <button onClick={onEnd} className="p-4 rounded-full bg-red-600 hover:bg-red-700">
          <X className="w-6 h-6" />
        </button>
      </div>
    </div>
  );
}
