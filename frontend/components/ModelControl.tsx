import * as React from 'react';
import { useState, useCallback, useEffect } from 'react';
import axios from 'axios';

interface ModelStatus {
  status: string;
  model?: string;
  database?: string;
  message?: string;
}

interface ModelControlProps {
    onModelLoad: (modelName: string) => Promise<void>;
    initialStatus?: ModelStatus;
}

const ModelControl: React.FC<ModelControlProps> = ({ onModelLoad, initialStatus }) => {
    const [status, setStatus] = useState<ModelStatus | null>(initialStatus || null);
    const [isLoading, setIsLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);

  const checkHealth = useCallback(async () => {
    setIsLoading(true);
    setError(null);
    try {
      const response = await axios.get('http://localhost:5000/health_check');
      setStatus(response.data);
    } catch (err) {
      const errorMessage = axios.isAxiosError(err) && err.response?.data?.message
        ? err.response.data.message
        : 'Failed to check health';
      setError(errorMessage);
      console.error('Health check error:', err);
    } finally {
      setIsLoading(false);
    }
  }, []);

  const loadModel = useCallback(async (modelName: string) => {
    setIsLoading(true);
    setError(null);
    try {
      await onModelLoad(modelName);
      setTimeout(checkHealth, 1000);
    } catch (err) {
      const errorMessage = axios.isAxiosError(err) && err.response?.data?.error
        ? err.response.data.error
        : 'Failed to load model';
      setError(errorMessage);
      console.error('Model loading error:', err);
    } finally {
      setIsLoading(false);
    }
  }, [checkHealth, onModelLoad]);

  // Initial health check
  useEffect(() => {
    checkHealth();
    // Set up periodic health checks every 30 seconds
    const interval = setInterval(checkHealth, 30000);
    return () => clearInterval(interval);
  }, [checkHealth]);

  return (
    <div className="bg-slate-800 shadow-lg rounded-lg p-6 border border-slate-700">
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-lg font-semibold text-slate-200">Model Control</h3>
        <div className="flex items-center gap-2">
          <span className="text-sm text-slate-400">Status:</span>
          <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium
            ${status?.status === 'healthy' ? 'bg-emerald-100 text-emerald-800' : 'bg-red-100 text-red-800'}`}>
            {status?.status || 'Unknown'}
          </span>
        </div>
      </div>
      
      <div className="flex flex-col gap-4">
        {/* Status Display */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="bg-slate-900/50 rounded-lg p-4 border border-slate-700">
            <p className="text-slate-400 text-sm mb-1">Current Model</p>
            <p className="text-slate-200 font-medium">{status?.model || 'None'}</p>
          </div>
          <div className="bg-slate-900/50 rounded-lg p-4 border border-slate-700">
            <p className="text-slate-400 text-sm mb-1">Database Status</p>
            <p className="text-slate-200 font-medium">{status?.database || 'Unknown'}</p>
          </div>
        </div>

        {/* Error Display */}
        {error && (
          <div className="bg-red-900/30 border border-red-500/30 p-4 rounded-lg text-red-200">
            {error}
          </div>
        )}

        {/* Controls */}
        <div className="flex flex-wrap gap-4">
          <button
            onClick={checkHealth}
            disabled={isLoading}
            className="px-4 py-2 bg-slate-700 hover:bg-slate-600 text-slate-200 
                     rounded-lg transition-colors disabled:opacity-50 
                     disabled:cursor-not-allowed border border-slate-600
                     inline-flex items-center gap-2"
          >
            {isLoading ? (
              <>
                <svg className="animate-spin h-4 w-4 text-slate-200" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                </svg>
                Checking...
              </>
            ) : 'Check Health'}
          </button>

          <button
            onClick={() => loadModel('yolov8n')}
            disabled={isLoading}
            className="px-4 py-2 bg-blue-600 hover:bg-blue-500 text-slate-200 
                     rounded-lg transition-colors disabled:opacity-50 
                     disabled:cursor-not-allowed"
          >
            Load YOLOv8n
          </button>

          <button
            onClick={() => loadModel('yolov8s')}
            disabled={isLoading}
            className="px-4 py-2 bg-blue-600 hover:bg-blue-500 text-slate-200 
                     rounded-lg transition-colors disabled:opacity-50 
                     disabled:cursor-not-allowed"
          >
            Load YOLOv8s
          </button>
        </div>
      </div>
    </div>
  );
};

export default ModelControl;