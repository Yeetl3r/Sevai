import { useEffect, useRef, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';

export default function DocumentScanner({ onDataExtracted, lang = 'en', stepKey, autoOpen = false }) {
  const [isOpen, setIsOpen] = useState(autoOpen);
  const [isCasting, setIsCasting] = useState(false);
  const [isExtracting, setIsExtracting] = useState(false);
  const [errorMsg, setErrorMsg] = useState(null);
  const [attemptCount, setAttemptCount] = useState(0);
  
  const [devices, setDevices] = useState([]);
  const [selectedDeviceId, setSelectedDeviceId] = useState('');

  const videoRef = useRef(null);
  const streamRef = useRef(null);
  const canvasRef = useRef(null);

  // Get available hardware cameras on mount
  useEffect(() => {
    navigator.mediaDevices.enumerateDevices().then(devs => {
      const v = devs.filter(d => d.kind === 'videoinput');
      setDevices(v);
      if (v.length > 0) {
        setSelectedDeviceId(v[0].deviceId);
      }
    });
  }, []);

  useEffect(() => {
    if (autoOpen && selectedDeviceId) {
      openCamera(selectedDeviceId);
    }
    return () => stopStream();
  }, [autoOpen, selectedDeviceId]);

  const openCamera = async (deviceId) => {
    setIsOpen(true);
    setErrorMsg(null);
    setIsCasting(true);

    try {
      let stream;
      try {
        if (deviceId) {
           stream = await navigator.mediaDevices.getUserMedia({
             video: { deviceId: { exact: deviceId } }
           });
        } else {
           stream = await navigator.mediaDevices.getUserMedia({ video: true });
        }
      } catch (e) {
        console.warn('Camera request failed, attempting generic fallback...', e);
        stream = await navigator.mediaDevices.getUserMedia({ video: true });
      }
      
      streamRef.current = stream;
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        try {
          await videoRef.current.play();
        } catch (playErr) {
          console.warn('Video play interrupted:', playErr);
        }
      }
    } catch (err) {
      console.error('Error accessing camera:', err);
      setErrorMsg(lang === 'ta' ? 'கேமரா அணுகல் மறுக்கப்பட்டது.' : 'Camera access denied or unavailable.');
      setIsCasting(false);
    }
  };

  const stopStream = () => {
    if (streamRef.current) {
      streamRef.current.getTracks().forEach(track => track.stop());
      streamRef.current = null;
    }
    setIsCasting(false);
  };

  const cancelScanner = () => {
    stopStream();
    setIsOpen(false);
    setErrorMsg(null);
  };

  const handleSwitchCamera = (e) => {
    const newId = e.target.value;
    stopStream();
    setSelectedDeviceId(newId);
  };

  const captureAndExtract = async () => {
    if (!videoRef.current || !canvasRef.current) return;
    
    const video = videoRef.current;
    const canvas = canvasRef.current;

    // Prevent corrupt base64 captures if the camera hasn't initialized its resolution yet
    if (!video.videoWidth || video.videoWidth === 0) {
        setErrorMsg(lang === 'ta' ? 'கேமரா தயாராக இல்லை. சற்று காத்திருக்கவும்.' : 'Camera warming up, please wait a second and try again.');
        return;
    }
    
    const MAX_WIDTH = 800;
    const scaleSize = Math.min(1, MAX_WIDTH / video.videoWidth);
    
    canvas.width = video.videoWidth * scaleSize;
    canvas.height = video.videoHeight * scaleSize;
    const ctx = canvas.getContext('2d');
    ctx.drawImage(video, 0, 0, canvas.width, canvas.height);

    // Get Base64 JPEG
    const base64Image = canvas.toDataURL('image/jpeg', 0.8);

    // Stop stream and show loading
    stopStream();
    setIsExtracting(true);
    setErrorMsg(null);

    try {
      const response = await fetch('/api/extract-document', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ image: base64Image, field: stepKey, lang }) // Context passed here!
      });

      const extractedData = await response.json();
      
      if (!response.ok || extractedData.error) {
        throw new Error(extractedData.error || 'Failed to extract data or invalid document.');
      }

      // Successfully processed
      setIsExtracting(false);
      setIsOpen(false);
      if (onDataExtracted) {
        onDataExtracted(extractedData, base64Image);
      }
    } catch (error) {
      console.error('Extraction error:', error);
      setIsExtracting(false);
      
      const newAttempts = attemptCount + 1;
      setAttemptCount(newAttempts);
      
      // If 3 attempts reached, close out and report manual fallback
      if (newAttempts >= 3) {
        setIsOpen(false);
        if (onDataExtracted) {
          onDataExtracted({ fallback: true });
        }
      } else {
        // Show retry button
        setErrorMsg(error.message || (lang === 'ta' ? 'தவறான ஆவணம். மீண்டும் முயற்சிக்கவும்.' : 'Invalid document. Please try again.'));
      }
    }
  };

  if (!isOpen) {
    return (
      <button
        onClick={() => openCamera(selectedDeviceId)}
        className="w-full flex items-center justify-center gap-3 p-4 mt-2 rounded-xl bg-gradient-to-r from-brand-green to-brand-green-dark text-white shadow-lg active:scale-95 transition-transform"
      >
        <span className="text-2xl">📸</span>
        <div className="text-left">
          <div className="font-bold">{lang === 'ta' ? 'ஸ்மார்ட் ஸ்கேன்' : 'Smart Scan ID'}</div>
          <div className="text-xs opacity-80">{lang === 'ta' ? 'தானாக நிரப்ப ஐடியை ஸ்கேன் செய்க' : 'Auto-fill form using camera'}</div>
        </div>
      </button>
    );
  }

  return (
    <div className="mt-2 rounded-2xl overflow-hidden bg-black shadow-xl relative border border-gray-800">
      {/* Hidden canvas for extraction */}
      <canvas ref={canvasRef} className="hidden" />

      {isExtracting ? (
        <div className="h-64 flex flex-col items-center justify-center p-6 bg-brand-bg relative overflow-hidden">
          <div className="absolute inset-0 bg-brand-green/5 animate-pulse" />
          <div className="text-4xl mb-4 relative z-10 animate-bounce">📄</div>
          <div className="text-brand-ink font-bold text-center relative z-10">
            {lang === 'ta' ? 'தரவை பிரித்தெடுக்கிறது...' : 'Extracting data...'}
          </div>
          <div className="text-xs text-brand-muted text-center mt-2 relative z-10 max-w-xs">
            {lang === 'ta' ? 'செயற்கை நுண்ணறிவு ஆவணத்தைப் படிக்கிறது' : 'AI is verifying and reading your document...'}
          </div>
        </div>
      ) : (
        <div className="bg-black text-white p-4">
          <div className="flex justify-between items-center mb-3">
            <h3 className="font-bold flex items-center gap-2">
              <span className="w-2 h-2 rounded-full bg-red-500 animate-pulse" />
              {lang === 'ta' ? 'கேமரா நேரடி காட்சி' : 'Live Camera'}
            </h3>
            <div className="flex items-center gap-3">
              <span className="text-xs text-white/50">Attempt {attemptCount}/3</span>
              <button onClick={cancelScanner} className="bg-white/20 hover:bg-white/30 rounded-full w-8 h-8 flex items-center justify-center text-sm transition-colors">
                ✕
              </button>
            </div>
          </div>
          
          <div className="relative rounded-xl overflow-hidden bg-gray-900 border border-white/10">
            {!isCasting && !errorMsg && (
                <div className="absolute inset-0 flex items-center justify-center">
                    <span className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin"></span>
                </div>
            )}
            
            <video 
              ref={videoRef} 
              autoPlay 
              playsInline 
              muted 
              className={`w-full h-auto max-h-[50vh] object-cover ${errorMsg ? 'hidden' : 'block'}`}
              onPlay={() => setIsCasting(true)}
            />
            
            {/* Guide overlay */}
            {isCasting && !errorMsg && (
              <div className="absolute inset-0 border-2 border-dashed border-white/40 m-6 rounded-lg pointer-events-none" />
            )}
            
            {errorMsg && (
               <div className="p-8 text-center text-red-500 font-bold bg-white h-48 flex items-center justify-center">
                 {errorMsg}
               </div>
            )}
          </div>
          
          {devices.length > 1 && (
            <div className="mt-4 px-2">
               <label className="text-xs text-white/70 block mb-1">Select Camera Hardware:</label>
               <select 
                 value={selectedDeviceId} 
                 onChange={handleSwitchCamera}
                 className="w-full bg-gray-800 text-white border border-gray-600 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand-green"
               >
                 {devices.map((d, i) => (
                   <option key={d.deviceId} value={d.deviceId}>
                     {d.label || `Camera ${i + 1}`}
                   </option>
                 ))}
               </select>
            </div>
          )}

          <div className="mt-4 flex justify-center">
            {errorMsg ? (
               <button onClick={() => openCamera(selectedDeviceId)} className="px-6 py-2 bg-white text-black font-bold rounded-full">
                 {lang === 'ta' ? 'மீண்டும் முயற்சிக்கவும்' : 'Retry Scanning'}
               </button>
            ) : (
               <button 
                  onClick={captureAndExtract} 
                  className="bg-white text-black font-bold h-16 w-16 rounded-full flex items-center justify-center shadow-[0_0_0_4px_rgba(255,255,255,0.3)] active:scale-95 transition-transform"
               >
                 <span className="text-xl">📷</span>
               </button>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
