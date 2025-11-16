import React, { useState, KeyboardEvent, useRef, ChangeEvent } from 'react';
import { AppMode } from '../types';
import { SendIcon, UploadIcon } from './Icons';

interface ChatInputProps {
  onSendMessage: (prompt: string, files: File[], imageOptions: {aspectRatio: string}) => void;
  isLoading: boolean;
  mode: AppMode;
}

const ChatInput: React.FC<ChatInputProps> = ({ onSendMessage, isLoading, mode }) => {
  const [input, setInput] = useState('');
  const [files, setFiles] = useState<File[]>([]);
  const [aspectRatio, setAspectRatio] = useState('1:1');
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleSend = () => {
    if ((input.trim() || files.length > 0) && !isLoading) {
      onSendMessage(input, files, { aspectRatio });
      setInput('');
      setFiles([]);
    }
  };

  const handleKeyPress = (event: KeyboardEvent<HTMLTextAreaElement>) => {
    if (event.key === 'Enter' && !event.shiftKey) {
      event.preventDefault();
      handleSend();
    }
  };

  const handleFileChange = (event: ChangeEvent<HTMLInputElement>) => {
    if (event.target.files) {
        if (mode === 'image' || mode === 'video') {
            setFiles(Array.from(event.target.files).slice(0, 1));
        } else {
            setFiles(Array.from(event.target.files));
        }
    }
  };

  const getFileAcceptType = () => {
      switch (mode) {
          case 'image': return 'image/*';
          case 'video': return 'image/*'; // Veo takes an initial image
          case 'chat': return 'image/*,video/*,audio/*';
          default: return '*/*';
      }
  }

  return (
    <div className="bg-gray-800 border border-gray-700 rounded-2xl p-2 flex flex-col gap-2">
      {files.length > 0 && (
          <div className="p-2 flex gap-2 overflow-x-auto">
              {files.map((file, index) => (
                  <div key={index} className="relative flex-shrink-0">
                      {file.type.startsWith('image/') ? (
                          <img src={URL.createObjectURL(file)} className="h-20 w-20 object-cover rounded-md" alt="file preview" />
                      ) : (
                          <div className="h-20 w-20 bg-gray-700 rounded-md flex items-center justify-center text-xs p-1 text-center">{file.name}</div>
                      )}
                      <button onClick={() => setFiles(f => f.filter((_, i) => i !== index))} className="absolute -top-1 -right-1 bg-red-500 text-white rounded-full h-5 w-5 text-xs">&times;</button>
                  </div>
              ))}
          </div>
      )}
      <div className="flex items-center gap-2">
          <button
            onClick={() => fileInputRef.current?.click()}
            disabled={isLoading}
            className="p-2 rounded-full text-gray-400 hover:bg-gray-700 hover:text-white transition-colors"
            aria-label="Attach file"
          >
              <UploadIcon />
          </button>
          <input type="file" ref={fileInputRef} onChange={handleFileChange} className="hidden" multiple={mode === 'chat'} accept={getFileAcceptType()} />

          <textarea
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={handleKeyPress}
            placeholder={
                mode === 'image' && files.length > 0 ? 'Describe how to edit the image...' :
                mode === 'video' && files.length > 0 ? 'Describe the video to generate from this image...' :
                'Type your message here...'
            }
            disabled={isLoading}
            className="w-full bg-transparent resize-none focus:outline-none disabled:opacity-50 max-h-32"
            rows={1}
          />
          <button
            onClick={handleSend}
            disabled={isLoading || (!input.trim() && files.length === 0)}
            className="p-2 rounded-full text-white bg-indigo-600 hover:bg-indigo-500 disabled:bg-gray-600 disabled:cursor-not-allowed transition-colors"
            aria-label="Send message"
          >
            <SendIcon />
          </button>
      </div>
        {mode === 'image' && files.length === 0 && (
             <div className="flex items-center gap-2 px-3 pb-1">
                 <span className="text-xs font-medium text-gray-400">Aspect Ratio:</span>
                 {['1:1', '16:9', '9:16', '4:3', '3:4'].map(ratio => (
                     <button key={ratio} onClick={() => setAspectRatio(ratio)} className={`px-2 py-0.5 text-xs rounded-md ${aspectRatio === ratio ? 'bg-indigo-500 text-white' : 'bg-gray-700 hover:bg-gray-600'}`}>
                         {ratio}
                     </button>
                 ))}
             </div>
        )}
    </div>
  );
};

export default ChatInput;
