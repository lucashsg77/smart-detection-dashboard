import * as React from 'react';
import { useState, useEffect } from 'react';

interface Prediction {
  class_name: string;
  confidence: number;
  box: { left: number; top: number; width: number; height: number };
}

interface DatabasePrediction {
  id: number;
  timestamp: string;
  image_name: string;
  video_filename: string;
  predictions: Prediction[];
}

interface PredictionsTableProps {
  currentPredictions: Prediction[];
}

const PredictionsTable: React.FC<PredictionsTableProps> = ({ currentPredictions }) => {
  const [historicalPredictions, setHistoricalPredictions] = useState<DatabasePrediction[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    // Initial fetch
    const fetchHistoricalPredictions = async () => {
      try {
        const response = await fetch('http://localhost:5000/predictions');
        if (!response.ok) {
          throw new Error('Failed to fetch historical predictions');
        }
        const data = await response.json();
        setHistoricalPredictions(data);
      } catch (err) {
        setError(err instanceof Error ? err.message : 'An error occurred');
        console.error('Error fetching predictions:', err);
      } finally {
        setIsLoading(false);
      }
    };

    fetchHistoricalPredictions();

    // Set up SSE connection
    const eventSource = new EventSource('http://localhost:5000/predictions/stream');
    
    eventSource.onmessage = (event) => {
      const data = JSON.parse(event.data);
      setHistoricalPredictions(data);
      setIsLoading(false);
    };

    eventSource.onerror = () => {
      eventSource.close();
      setError('Lost connection to server');
    };

    return () => {
      eventSource.close();
    };
  }, []);

  const processedPredictions = React.useMemo(() => {
    if (historicalPredictions.length === 0 && currentPredictions.length === 0) {
      return [];
    }

    const currentEntries = currentPredictions.map(pred => ({
      timestamp: new Date().toISOString(),
      prediction: pred,
      isCurrentFrame: true
    }));

    const historicalEntries = historicalPredictions.flatMap(hist =>
      hist.predictions.map(pred => ({
        timestamp: hist.timestamp,
        prediction: pred,
        isCurrentFrame: false
      }))
    );

    return [...currentEntries, ...historicalEntries].slice(0, 10);
  }, [currentPredictions, historicalPredictions]);

  if (isLoading) {
    return (
      <div className="w-full bg-slate-800 shadow-lg rounded-lg border border-slate-700 p-8">
        <div className="flex justify-center items-center">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-slate-200"></div>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="w-full bg-slate-800 shadow-lg rounded-lg border border-slate-700 p-4">
        <div className="text-red-400 text-center">Error: {error}</div>
      </div>
    );
  }

  if (processedPredictions.length === 0) {
    return (
      <div className="w-full bg-slate-800 shadow-lg rounded-lg border border-slate-700 p-4">
        <div className="text-slate-400 text-center">No predictions available</div>
      </div>
    );
  }

  return (
    <div className="w-full overflow-x-auto bg-slate-800 shadow-lg rounded-lg border border-slate-700">
      <div className="px-4 py-3 border-b border-slate-700">
        <h3 className="text-lg font-semibold text-slate-200">Recent Predictions</h3>
      </div>

      <table className="min-w-full divide-y divide-slate-700">
        <thead className="bg-slate-900">
          <tr>
            <th className="px-4 py-2 text-left font-semibold text-slate-300">Time</th>
            <th className="px-4 py-2 text-left font-semibold text-slate-300">Source</th>
            <th className="px-4 py-2 text-left font-semibold text-slate-300">Class</th>
            <th className="px-4 py-2 text-left font-semibold text-slate-300">Confidence</th>
            <th className="px-4 py-2 text-left font-semibold text-slate-300">Position</th>
            <th className="px-4 py-2 text-left font-semibold text-slate-300">Size</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-slate-700">
          {processedPredictions.map((entry, idx) => (
            <tr 
              key={`${entry.timestamp}-${idx}`}
              className={`${
                entry.isCurrentFrame ? 'bg-slate-700/50' : (idx % 2 === 0 ? 'bg-slate-800' : 'bg-slate-800/50')
              } hover:bg-slate-700 transition-colors`}
            >
              <td className="px-4 py-2 text-slate-300 whitespace-nowrap">
                {new Date(entry.timestamp).toLocaleTimeString()}
              </td>
              <td className="px-4 py-2 text-slate-300">
                {entry.isCurrentFrame ? 'Current Frame' : 'Historical'}
              </td>
              <td className="px-4 py-2">
                <span className="font-medium text-slate-200">{entry.prediction.class_name}</span>
              </td>
              <td className="px-4 py-2 text-slate-300">
                {(entry.prediction.confidence * 100).toFixed(1)}%
              </td>
              <td className="px-4 py-2 text-slate-300">
                ({entry.prediction.box.left}, {entry.prediction.box.top})
              </td>
              <td className="px-4 py-2 text-slate-300">
                {entry.prediction.box.width} × {entry.prediction.box.height}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
};

export default PredictionsTable;