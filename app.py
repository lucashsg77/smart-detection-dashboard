import numpy as np
import cv2
import time
from PIL import Image
import onnxruntime as ort
from typing import List
from dataclasses import dataclass
from flask import Flask, request, jsonify, Response, stream_with_context
import json
from smart_open import open
from db import Session, Inference 
import logging
import os
from flask_cors import CORS
from sqlalchemy import text

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)
app = Flask(__name__)
CORS(app, resources={
    r"/*": {
        "origins": ["http://localhost:5173", "http://localhost:5174"],
        "methods": ["GET", "POST", "OPTIONS"],
        "allow_headers": ["Content-Type"]
    }
})
@dataclass
class BBOX:
    left: int
    top: int
    width: int
    height: int

@dataclass
class Prediction:
    class_name: int
    confidence: float
    box: BBOX
    
    def to_dict(self):
        return {
            "class_name": str(self.class_name),
            "confidence": float(self.confidence),
            "box": {
                "left": int(self.box.left),
                "top": int(self.box.top),
                "width": int(self.box.width),
                "height": int(self.box.height)
            }
        }

class Model:
    def __init__(self, model_name: str):
        self.model_name = model_name
        providers = ort.get_available_providers()
        print(f"Available providers: {providers}")
        self.model = ort.InferenceSession(f"models/{model_name}.onnx", providers=providers)
        self.input_name = self.model.get_inputs()[0].name
        self.output_name = self.model.get_outputs()[0].name
        self.input_width = self.model.get_inputs()[0].shape[2]
        self.input_height = self.model.get_inputs()[0].shape[3]
        self.idx2class = eval(self.model.get_modelmeta().custom_metadata_map['names'])
    
    def preprocess(
        self, 
        img: Image.Image
    ) -> np.ndarray:
        img = img.resize((self.input_width, self.input_height))
        img = np.array(img).transpose(2, 0, 1)
        img = np.expand_dims(img, axis=0)
        img = img / 255.0
        img = img.astype(np.float32)
        return img
    
    def postprocess(
        self, 
        output: np.ndarray, 
        confidence_thresh: float, 
        iou_thresh: float,
        img_width: int,
        img_height: int
    ) -> List[Prediction]:
        
        outputs = np.transpose(np.squeeze(output[0]))
        rows = outputs.shape[0]
        boxes = []
        scores = []
        class_ids = []
        x_factor = img_width / self.input_width
        y_factor = img_height / self.input_height
        for i in range(rows):
            classes_scores = outputs[i][4:]
            max_score = np.amax(classes_scores)
            if max_score >= confidence_thresh:
                class_id = np.argmax(classes_scores)
                x, y, w, h = outputs[i][0], outputs[i][1], outputs[i][2], outputs[i][3]
                left = int((x - w / 2) * x_factor)
                top = int((y - h / 2) * y_factor)
                width = int(w * x_factor)
                height = int(h * y_factor)
                class_ids.append(class_id)
                scores.append(max_score)
                boxes.append([left, top, width, height])
        indices = cv2.dnn.NMSBoxes(boxes, scores, confidence_thresh, iou_thresh)
        detections = []
        if len(indices) > 0:
            for i in indices.flatten():
                left, top, width, height = boxes[i]
                class_id = class_ids[i]
                score = scores[i]
                detection = Prediction(
                    class_name=self.idx2class[class_id],
                    confidence=score,
                    box=BBOX(left, top, width, height)
                )
                detections.append(detection)
        return detections

    def __call__(
        self, 
        img: Image.Image,
        confidence_thresh: float, 
        iou_thresh: float
    ) -> List[Prediction]:
        img_input = self.preprocess(img)
        outputs = self.model.run(None, {self.input_name: img_input})
        predictions = self.postprocess(outputs, confidence_thresh, iou_thresh, img.width, img.height)
        return predictions


model = None
try:
    model = Model("yolov8n")
    logger.info("Model loaded successfully")
except Exception as e:
    logger.error(f"Failed to load model: {str(e)}")

@app.route('/detect', methods=['POST'])
def detect():
    try:
        if model is None:
            return jsonify({"error": "Model not initialized"}), 500

        if 'file' not in request.files:
            return jsonify({"error": "No file provided"}), 400

        start_time = time.time()
        
        file = request.files['file']
        original_img = Image.open(file).convert('RGB')
        image_name = file.filename
        video_filename = request.form.get('video_filename', 'unknown.mp4')
        confidence = float(request.form.get('confidence', 0.7))
        iou = float(request.form.get('iou', 0.5))

        predictions = model(original_img, confidence, iou)
        detections = [p.to_dict() for p in predictions]
        
        processing_time = time.time() - start_time

        session = Session()
        try:
            inference = Inference(
                image_name=image_name,
                video_filename=video_filename,
                predictions=detections,
                confidence_threshold=confidence,
                iou_threshold=iou,
                processing_time=processing_time,
                model_version=model.model_name
            )
            session.add(inference)
            session.commit()
        except Exception as db_error:
            session.rollback()
            logger.error(f"Database error: {str(db_error)}")
            raise
        finally:
            session.close()

        logger.info(f"Detected {len(detections)} objects in {image_name}")
        return jsonify(detections)

    except Exception as e:
        logger.error(f"Error in detect endpoint: {str(e)}")
        return jsonify({"error": str(e)}), 500

@app.route('/predictions', methods=['GET'])
def get_predictions():
    try:
        session = Session()
        results = session.query(
            Inference.id,
            Inference.timestamp,
            Inference.image_name,
            Inference.video_filename,
            Inference.predictions,
            Inference.confidence_threshold,
            Inference.iou_threshold,
            Inference.processing_time,
            Inference.model_version
        ).order_by(Inference.timestamp.desc()).limit(10).all()
        session.close()
        
        return jsonify([{
            'id': r.id,
            'timestamp': r.timestamp.isoformat(),
            'image_name': r.image_name,
            'video_filename': r.video_filename,
            'predictions': r.predictions,
            'confidence_threshold': r.confidence_threshold,
            'iou_threshold': r.iou_threshold,
            'processing_time': r.processing_time,
            'model_version': r.model_version
        } for r in results])
    except Exception as e:
        logger.error(f"Error fetching predictions: {str(e)}")
        return jsonify({"error": str(e)}), 500

@app.route('/health_check', methods=['GET'])
def health_check():
    try:
        if model is None:
            return jsonify({"status": "error", "message": "Model not loaded"}), 500

        session = Session()
        try:
            session.execute(text("SELECT 1"))
            db_status = "connected"
        except Exception as db_error:
            logger.error(f"Database connection error: {str(db_error)}")
            db_status = "disconnected"
        finally:
            session.close()
        
        return jsonify({
            "status": "healthy",
            "model": model.model_name,
            "database": db_status
        })
    except Exception as e:
        logger.error(f"Health check failed: {str(e)}")
        return jsonify({
            "status": "error",
            "message": str(e)
        }), 500

@app.route('/predictions/stream')
def stream_predictions():
    def generate():
        while True:
            try:
                session = Session()
                results = session.query(
                    Inference.id,
                    Inference.timestamp,
                    Inference.image_name,
                    Inference.video_filename,
                    Inference.predictions,
                    Inference.confidence_threshold,
                    Inference.iou_threshold,
                    Inference.processing_time,
                    Inference.model_version
                ).order_by(Inference.timestamp.desc()).limit(10).all()
                
                data = [{
                    'id': r.id,
                    'timestamp': r.timestamp.isoformat(),
                    'image_name': r.image_name,
                    'video_filename': r.video_filename,
                    'predictions': r.predictions,
                    'confidence_threshold': r.confidence_threshold,
                    'iou_threshold': r.iou_threshold,
                    'processing_time': r.processing_time,
                    'model_version': r.model_version
                } for r in results]
                
                yield f"data: {json.dumps(data)}\n\n"
                
            except Exception as e:
                logger.error(f"Error in SSE stream: {str(e)}")
                yield f"data: {json.dumps([])}\n\n"
            finally:
                session.close()
            
            time.sleep(1)  # Wait 1 second between updates

    return Response(
        stream_with_context(generate()),
        mimetype='text/event-stream',
        headers={
            'Cache-Control': 'no-cache',
            'Connection': 'keep-alive',
            'Access-Control-Allow-Origin': '*'
        }
    )

@app.route('/load_model', methods=['POST'])
def load_model():
    try:
        model_name = request.json.get('model_name')
        if not model_name:
            return jsonify({"error": "model_name is required"}), 400

        global model
        model = Model(model_name)
        return jsonify({"message": f"Model {model_name} loaded successfully"})
    except Exception as e:
        logger.error(f"Error loading model: {str(e)}")
        return jsonify({"error": str(e)}), 500

if __name__ == "__main__":
    port = int(os.environ.get("PORT", 5000))
    app.run(host='0.0.0.0', port=port)