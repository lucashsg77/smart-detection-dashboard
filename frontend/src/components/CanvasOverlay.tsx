import * as React from 'react';
import { useEffect, useRef } from 'react';
import { FabricImage, Canvas, Rect, Text } from 'fabric';

interface CanvasOverlayProps {
  backgroundImage: string;
  predictions: Array<{
    class_name: string;
    confidence: number;
    box: { left: number; top: number; width: number; height: number };
  }>;
}

const CanvasOverlay: React.FC<CanvasOverlayProps> = ({ backgroundImage, predictions }) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const fabricCanvasRef = useRef<Canvas | null>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const canvasElement = canvasRef.current;
    const container = containerRef.current;
    if (!canvasElement || !container || !backgroundImage) return;

    if (fabricCanvasRef.current) {
      fabricCanvasRef.current.dispose();
    }

    fabricCanvasRef.current = new Canvas(canvasElement);
    const canvas = fabricCanvasRef.current;

    FabricImage.fromURL(backgroundImage, {
      crossOrigin: 'anonymous',
    }, (img: FabricImage) => {
      if (!canvas) return;

      const containerWidth = container.clientWidth;
      const aspectRatio = img.width! / img.height!;
      const canvasHeight = containerWidth / aspectRatio;

      canvas.setWidth(containerWidth);
      canvas.setHeight(canvasHeight);

      img.scaleToWidth(containerWidth);
      canvas.backgroundImage = img;
      canvas.renderAll();

      const scaleX = containerWidth / img.width!;
      const scaleY = canvasHeight / img.height!;

      predictions.forEach((pred) => {
 
        const scaledBox = {
          left: pred.box.left * scaleX,
          top: pred.box.top * scaleY,
          width: pred.box.width * scaleX,
          height: pred.box.height * scaleY
        };

        const rect = new Rect({
          left: scaledBox.left,
          top: scaledBox.top,
          width: scaledBox.width,
          height: scaledBox.height,
          fill: 'transparent',
          stroke: 'red',
          strokeWidth: 2,
          selectable: false,
          evented: false
        });

        const label = new Text(
          `${pred.class_name} ${(pred.confidence * 100).toFixed(1)}%`,
          {
            left: scaledBox.left,
            top: Math.max(0, scaledBox.top - 20),
            fontSize: 16,
            fill: 'red',
            backgroundColor: 'rgba(255, 255, 255, 0.7)',
            padding: 2,
            selectable: false,
            evented: false
          }
        );

        canvas.add(rect);
        canvas.add(label);
      });

      canvas.renderAll();
    });

    // Cleanup function
    return () => {
      if (fabricCanvasRef.current) {
        fabricCanvasRef.current.dispose();
        fabricCanvasRef.current = null;
      }
    };
  }, [backgroundImage, predictions]);

  return (
    <div 
      ref={containerRef} 
      className="w-full border rounded-lg overflow-hidden"
    >
      <canvas ref={canvasRef} />
    </div>
  );
};

export default CanvasOverlay;