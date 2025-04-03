# Real-Time Object Detection Dashboard

A full-stack web application for real-time object detection using YOLOv8, built with React, Flask, and PostgreSQL. The application provides a user-friendly interface for video analysis with dynamic model switching and real-time detection visualization.

![image](https://github.com/user-attachments/assets/c675b10a-3c09-4a78-81f8-511aaeb39a8c)

## Features

- 🎥 Real-time video processing and object detection
- 🔄 Dynamic model switching (YOLOv8n and YOLOv8s) without stopping video playback
- 📊 Live visualization of detection results with bounding boxes
- ⚙️ Adjustable confidence and IoU thresholds
- 📝 Historical prediction tracking with SSE (Server-Sent Events)
- 🎯 Detection results table with real-time updates
- 🖥️ Modern, responsive dark mode UI
- 🗄️ PostgreSQL database for persistent storage of detection results

## Tech Stack

### Frontend
- React with TypeScript
- Fabric.js for canvas manipulation
- TailwindCSS for styling
- React Player for video playback
- Server-Sent Events for real-time updates

### Backend
- Flask for the API server
- ONNX Runtime for model inference
- SQLAlchemy for database ORM
- PostgreSQL for data storage
- OpenCV for image processing

## Getting Started

### Prerequisites
- Docker and Docker Compose
- Node.js (for local development)
- Python 3.8+
- PostgreSQL

### Installation

1. Clone the repository:

2. Start the application using Docker Compose:
```bash
docker-compose up --build -d
```

The application will be available at:
- Frontend: http://localhost:5173
- Backend API: http://localhost:5000

### Environment Variables

Backend:
```
DATABASE_URI=postgresql+psycopg2://myuser:mypassword@postgres:5432/mydatabase
```

Frontend:
```
VITE_API_URL=http://localhost:5173
```

## API Endpoints

- `POST /detect` - Process a single frame for object detection
- `GET /predictions` - Get historical predictions
- `GET /predictions/stream` - SSE endpoint for real-time prediction updates
- `GET /health_check` - Check system health status
- `POST /load_model` - Load a specific YOLO model

## Development

### Running Locally

1. Start the backend:
```bash
cd backend
pip install -r requirements.txt
python app.py
```

2. Start the frontend:
```bash
cd frontend
npm install
npm run dev
```

### Database Management

The application uses SQLAlchemy for database operations. Database migrations can be performed by:

```bash
# Initialize database
python -c "from db import init_db; init_db()"
```

## Contributing

1. Fork the repository
2. Create your feature branch (`git checkout -b feature/AmazingFeature`)
3. Commit your changes (`git commit -m 'Add some AmazingFeature'`)
4. Push to the branch (`git push origin feature/AmazingFeature`)
5. Open a Pull Request

## License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.
