import * as React from 'react';
import { useEffect, useRef, useState, useCallback } from 'react';
import { Canvas, Rect, Text, FabricImage } from 'fabric';
import ReactPlayer from 'react-player';

interface DetectionViewerProps {
  videoSrc: string;
  predictions: Array<{
    class_name: string;
    confidence: number;
    box: { left: number; top: number; width: number; height: number };
  }>;
  onFrameCapture: (canvas: HTMLCanvasElement) => Promise<void>;
  modelStatus: { status: string; model?: string };
}

const DetectionViewer: React.FC<DetectionViewerProps> = ({
  videoSrc,
  predictions,
  onFrameCapture,
  modelStatus
}) => {
  const playerRef = useRef<ReactPlayer>(null);
  const captureCanvasRef = useRef<HTMLCanvasElement>(null);
  const resultCanvasRef = useRef<HTMLCanvasElement>(null);
  const fabricCanvasRef = useRef<Canvas | null>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const latestFrameRef = useRef<string>('');
  
  const [videoAspect, setVideoAspect] = useState<number>(16 / 9);
  const [isPlaying, setIsPlaying] = useState(false);
  const [videoDimensions, setVideoDimensions] = useState({ width: 0, height: 0 });
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (modelStatus.status === 'error') {
      setError('Model error - detection paused');
      setIsPlaying(false);
    } else {
      setError(null);
      if (isPlaying) {
        setIsPlaying(false);
        // Brief pause to let model load completely
        setTimeout(() => setIsPlaying(true), 500);
      }
    }
  }, [modelStatus]);

  useEffect(() => {
    if (!resultCanvasRef.current) return;

    fabricCanvasRef.current = new Canvas(resultCanvasRef.current, {
      selection: false,
      renderOnAddRemove: true,
    });

    if (!captureCanvasRef.current) {
      captureCanvasRef.current = document.createElement('canvas');
    }

    return () => {
      fabricCanvasRef.current?.dispose();
      fabricCanvasRef.current = null;
    };
  }, []);

  const handlePlay = () => {
    if (modelStatus.status === 'error') {
      setError('Cannot start detection - model error');
      return;
    }
    setIsPlaying(true);
  };

  const handleVideoReady = () => {
    const videoEl = playerRef.current?.getInternalPlayer() as HTMLVideoElement;
    if (!videoEl) return;

    const videoWidth = videoEl.videoWidth;
    const videoHeight = videoEl.videoHeight;
    const aspect = videoWidth / videoHeight;
    
    setVideoAspect(aspect);
    setVideoDimensions({ width: videoWidth, height: videoHeight });

    if (captureCanvasRef.current) {
      captureCanvasRef.current.width = videoWidth;
      captureCanvasRef.current.height = videoHeight;
    }
  };

  const resizeFabricToContainer = useCallback(() => {
    if (!fabricCanvasRef.current || !containerRef.current || !videoDimensions.width) return;

    const containerWidth = containerRef.current.clientWidth;
    const containerHeight = containerWidth / videoAspect;

    fabricCanvasRef.current.setWidth(containerWidth);
    fabricCanvasRef.current.setHeight(containerHeight);
    fabricCanvasRef.current.setZoom(containerWidth / videoDimensions.width);

    if (latestFrameRef.current) {
      updateFabricCanvas(latestFrameRef.current);
    }
  }, [videoAspect, videoDimensions]);

  useEffect(() => {
    resizeFabricToContainer();
  }, [videoAspect, resizeFabricToContainer, videoDimensions]);

useEffect(() => {
  window.addEventListener('resize', resizeFabricToContainer);
  return () => window.removeEventListener('resize', resizeFabricToContainer);
}, [resizeFabricToContainer]);

  const updateFabricCanvas = useCallback(
    (frameData: string) => {
      const fabricCanvas = fabricCanvasRef.current;
      if (!fabricCanvas) return;

      FabricImage.fromURL(frameData, { crossOrigin: 'anonymous' })
        .then((img: FabricImage) => {
          fabricCanvas.clear();

          img.set({
            scaleX: 1,
            scaleY: 1,
            originX: 'left',
            originY: 'top',
          });

          fabricCanvas.backgroundImage = img;

          predictions.forEach((pred) => {
            const rect = new Rect({
                left: pred.box.left,
                top: pred.box.top,
                width: pred.box.width,
                height: pred.box.height,
                fill: 'transparent',
                stroke: '#3b82f6',
                strokeWidth: 2,
                selectable: false,
                evented: false,
              });
  
              const label = new Text(
                `${pred.class_name} ${(pred.confidence * 100).toFixed(1)}%`,
                {
                  left: pred.box.left,
                  top: Math.max(0, pred.box.top - 20),
                  fontSize: 36,
                  fontWeight: 'bold',
                  fill: '#3b82f6',
                  backgroundColor: 'rgba(15, 23, 42, 0.75)',
                  padding: 4,
                  selectable: false,
                  evented: false,
                }
              );

            fabricCanvas.add(rect);
            fabricCanvas.add(label);
          });

          fabricCanvas.renderAll();
        })
        .catch((err) => {
          console.error('Error loading image: ', err);
        });
    },
    [predictions]
  );

  const processVideoFrame = useCallback(async () => {
    const videoEl = playerRef.current?.getInternalPlayer() as HTMLVideoElement;
    if (!videoEl || !captureCanvasRef.current) return;

    const ctx = captureCanvasRef.current.getContext('2d');
    if (!ctx) return;

    ctx.drawImage(
      videoEl,
      0,
      0,
      captureCanvasRef.current.width,
      captureCanvasRef.current.height
    );

    const frameData = captureCanvasRef.current.toDataURL('image/jpeg');
    latestFrameRef.current = frameData;

    await onFrameCapture(captureCanvasRef.current);
    updateFabricCanvas(frameData);
  }, [onFrameCapture, updateFabricCanvas]);

  useEffect(() => {
    let canceled = false;
    const detectionDelay = 500;
    async function loopFrames() {
      while (!canceled && isPlaying) {
        await processVideoFrame();
        await new Promise((res) => setTimeout(res, detectionDelay));
      }
    }
    if (isPlaying) loopFrames();
    return () => {
      canceled = true;
    };
  }, [isPlaying, processVideoFrame]);

  useEffect(() => {
    if (latestFrameRef.current) {
      updateFabricCanvas(latestFrameRef.current);
    }
  }, [predictions, updateFabricCanvas]);

  return (
    <div className="flex flex-col gap-6">
      <div className="w-full bg-slate-800 shadow-lg rounded-lg overflow-hidden border border-slate-700">
        {error && (
          <div className="px-4 py-2 bg-red-900/50 border-b border-red-500/50 text-red-200">
            {error}
          </div>
        )}
        <div className="relative w-full" style={{ aspectRatio: videoAspect }}>
          <ReactPlayer
            ref={playerRef}
            url={videoSrc}
            width="100%"
            height="100%"
            controls
            playing={isPlaying}
            onReady={handleVideoReady}
            onPlay={handlePlay}
            onPause={() => setIsPlaying(false)}
            onEnded={() => setIsPlaying(false)}
            className="absolute top-0 left-0 w-full h-full"
          />
        </div>
      </div>

      <div className="w-full bg-slate-800 shadow-lg rounded-lg overflow-hidden border border-slate-700">
        <div className="px-4 pt-4 flex justify-between items-center">
          <h3 className="text-lg font-semibold text-slate-200">Detection Results</h3>
          <span className="text-sm text-slate-400">
            Model: {modelStatus.model || 'None'}
          </span>
        </div>

        <div ref={containerRef} className="relative w-full" style={{ aspectRatio: videoAspect }}>
          <canvas
            ref={resultCanvasRef}
            className="absolute top-0 left-0 w-full h-full"
          />
        </div>

        <div className="pb-4" />
      </div>
    </div>
  );
};

export default DetectionViewer;