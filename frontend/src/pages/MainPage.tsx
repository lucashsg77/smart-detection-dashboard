import * as React from 'react';
import { useState, Suspense, useCallback, useEffect } from 'react';
import axios from 'axios';
import VideoUploader from '../components/VideoUploader';

const DetectionViewer = React.lazy(() => import('../components/DetectionViewer'));
const ConfigPanel = React.lazy(() => import('../components/ConfigPanel'));
const PredictionsTable = React.lazy(() => import('../components/PredictionsTable'));
const ModelControl = React.lazy(() => import('../components/ModelControl'));

interface Prediction {
  class_name: string;
  confidence: number;
  box: { left: number; top: number; width: number; height: number };
}

const MainPage: React.FC = () => {
  const [videoFile, setVideoFile] = useState<File | null>(null);
  const [videoUrl, setVideoUrl] = useState<string>('');
  const [predictions, setPredictions] = useState<Prediction[]>([]);
  const [confidence, setConfidence] = useState<number>(0.7);
  const [iou, setIou] = useState<number>(0.5);
  const [isProcessing, setIsProcessing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [modelStatus, setModelStatus] = useState<{ status: string; model?: string }>({ 
    status: 'loading' 
  });

  const handleUpload = useCallback((file: File) => {
    setVideoFile(file);
    setVideoUrl(URL.createObjectURL(file));
    setPredictions([]);
    setError(null);
  }, []);

  useEffect(() => {
    const checkHealth = async () => {
      try {
        const response = await axios.get('http://localhost:5000/health_check');
        setModelStatus({
          status: response.data.status,
          model: response.data.model
        });
      } catch (err) {
        setModelStatus({ status: 'error' });
      }
    };
    
    checkHealth();
  }, []);

  const handleModelLoad = useCallback(async (modelName: string) => {
    try {
      await axios.post('http://localhost:5000/load_model', { model_name: modelName });
      const healthResponse = await axios.get('http://localhost:5000/health_check');
      setModelStatus({
        status: healthResponse.data.status,
        model: healthResponse.data.model
      });
    } catch (err) {
      setModelStatus({ status: 'error' });
      setError(err instanceof Error ? err.message : 'Failed to load model');
      throw err; // Important to throw so ModelControl can handle the error
    }
  }, []);

  const handleFrameCapture = useCallback(
    async (canvas: HTMLCanvasElement) => {
      if (isProcessing) return;
      setIsProcessing(true);
      setError(null);
      
      try {
        const blob = await new Promise<Blob>((resolve) => {
          canvas.toBlob((b) => resolve(b!), 'image/jpeg', 1.0);
        });
        
        const formData = new FormData();
        formData.append('file', blob, 'frame.jpg');
        formData.append('confidence', confidence.toString());
        formData.append('iou', iou.toString());
        
        if (videoFile) {
          formData.append('video_filename', videoFile.name);
        }
        
        const response = await axios.post('http://localhost:5000/detect', formData, {
          headers: { 'Content-Type': 'multipart/form-data' }
        });
        
        setPredictions(response.data);
      } catch (err) {
        console.error("Error in detection:", err);
        setError(err instanceof Error ? err.message : 'An error occurred during detection');
      } finally {
        setIsProcessing(false);
      }
    },
    [confidence, iou, isProcessing, videoFile]
  );

  return (
    <div className="min-h-screen bg-slate-900 p-8">
      <h1 className="text-5xl font-extrabold text-center text-slate-100 mb-8">
        Smart Object Detection Dashboard
      </h1>
      
      <div className="max-w-7xl mx-auto space-y-8">
        <Suspense fallback={<div className="text-center text-slate-400">Loading Model Control...</div>}>
            <ModelControl 
              onModelLoad={handleModelLoad}
              initialStatus={modelStatus}
            />
          </Suspense>

        <VideoUploader onUpload={handleUpload} />

        {error && (
          <div className="bg-red-900/50 border border-red-500/50 text-red-200 px-4 py-2 rounded">
            {error}
          </div>
        )}

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
          <div className="bg-slate-800 shadow-xl rounded-lg p-4 border border-slate-700">
            <Suspense fallback={<div className="text-center text-slate-400">Loading Detection Viewer...</div>}>
              {videoUrl && (
              <DetectionViewer
                videoSrc={videoUrl}
                predictions={predictions}
                onFrameCapture={handleFrameCapture}
                modelStatus={modelStatus}
              />
              )}
            </Suspense>
          </div>

          <div className="space-y-8">
            <Suspense fallback={<div className="text-center text-slate-400">Loading Config...</div>}>
              <ConfigPanel
                confidence={confidence}
                iou={iou}
                onConfidenceChange={setConfidence}
                onIouChange={setIou}
              />
            </Suspense>

            <Suspense fallback={<div className="text-center text-slate-400">Loading Predictions...</div>}>
              <PredictionsTable currentPredictions={predictions} />
            </Suspense>
          </div>
        </div>
      </div>
    </div>
  );
};

export default MainPage;
