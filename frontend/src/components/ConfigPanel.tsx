import * as React from 'react';

interface ConfigPanelProps {
  confidence: number;
  iou: number;
  onConfidenceChange: (value: number) => void;
  onIouChange: (value: number) => void;
}

const ConfigPanel: React.FC<ConfigPanelProps> = ({ confidence, iou, onConfidenceChange, onIouChange }) => {
  return (
    <div className="bg-slate-800 shadow-lg rounded-lg p-6 border border-slate-700">
      <div className="mb-5">
        <label className="block text-slate-200 font-semibold mb-2">Confidence Threshold</label>
        <input
          type="number"
          step="0.1"
          value={confidence}
          min="0.1"
          max="1.0"
          onChange={(e) => onConfidenceChange(parseFloat(e.target.value))}
          className="w-full bg-slate-900 border border-slate-600 rounded-lg p-3 
                     text-slate-200 focus:outline-none focus:ring-2 focus:ring-slate-500
                     focus:border-transparent"
        />
      </div>
      <div>
        <label className="block text-slate-200 font-semibold mb-2">IoU Threshold</label>
        <input
          type="number"
          step="0.1"
          value={iou}
          min="0.1"
          max="1.0"
          onChange={(e) => onIouChange(parseFloat(e.target.value))}
          className="w-full bg-slate-900 border border-slate-600 rounded-lg p-3 
                     text-slate-200 focus:outline-none focus:ring-2 focus:ring-slate-500
                     focus:border-transparent"
        />
      </div>
    </div>
  );
};

export default ConfigPanel;
