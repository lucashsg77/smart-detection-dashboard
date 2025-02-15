import * as React from 'react';
const { useState } = React;

interface VideoUploaderProps {
  onUpload: (file: File) => void;
}

const VideoUploader: React.FC<VideoUploaderProps> = ({ onUpload }) => {
  const [file, setFile] = useState<File | null>(null);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      const selectedFile = e.target.files[0];
      setFile(selectedFile);
      onUpload(selectedFile);
    }
  };

  return (
    <div className="bg-slate-800 shadow-lg rounded-lg p-6 border border-slate-700">
      <label className="block text-lg text-slate-200 font-semibold mb-3">Upload Video</label>
      <input 
        type="file" 
        accept="video/*" 
        onChange={handleChange} 
        className="block w-full text-sm text-slate-300 file:mr-4 file:py-2 file:px-4 
                   file:border-0 file:text-sm file:font-medium file:bg-slate-700 
                   file:text-slate-200 hover:file:bg-slate-600 
                   file:rounded-md transition-colors"
      />
      {file && <p className="mt-3 text-sm text-slate-400">Selected video: {file.name}</p>}
    </div>
  );
};

export default VideoUploader;
