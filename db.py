import os
import time
from datetime import datetime
from sqlalchemy import create_engine, Column, Integer, String, Float, JSON, DateTime, Index, text
from sqlalchemy.ext.declarative import declarative_base
from sqlalchemy.orm import sessionmaker
from sqlalchemy.exc import OperationalError
import logging

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

DATABASE_URI = os.environ.get(
    'DATABASE_URI',
    "postgresql+psycopg2://myuser:mypassword@postgres:5432/mydatabase"
)

def get_database_connection(max_retries=5, retry_interval=5):
    for attempt in range(max_retries):
        try:
            engine = create_engine(
                DATABASE_URI,
                pool_size=5,
                max_overflow=10,
                pool_timeout=30,
                pool_recycle=1800
            )
            engine.connect()
            logger.info("Database connection established successfully")
            return engine
        except OperationalError as e:
            if attempt < max_retries - 1:
                logger.warning(f"Database connection attempt {attempt + 1} failed. Retrying in {retry_interval} seconds...")
                time.sleep(retry_interval)
            else:
                logger.error("Failed to connect to database after maximum retries")
                raise e

engine = get_database_connection()
Session = sessionmaker(bind=engine)
Base = declarative_base()

class Inference(Base):
    __tablename__ = 'inferences'
    
    id = Column(Integer, primary_key=True)
    timestamp = Column(DateTime, default=datetime.utcnow, nullable=False)
    image_name = Column(String, nullable=False)
    video_filename = Column(String, nullable=False)
    frame_number = Column(Integer)
    predictions = Column(JSON, nullable=False)
    confidence_threshold = Column(Float, nullable=False)
    iou_threshold = Column(Float, nullable=False)
    processing_time = Column(Float)
    error = Column(String)
    model_version = Column(String)

    __table_args__ = (
        Index('ix_inferences_timestamp', timestamp.desc()),
        Index('ix_inferences_video_filename', video_filename),
    )

    def __repr__(self):
        return f"<Inference(id={self.id}, image_name={self.image_name}, predictions={len(self.predictions)})>"

    def to_dict(self):
        return {
            'id': self.id,
            'timestamp': self.timestamp.isoformat(),
            'image_name': self.image_name,
            'video_filename': self.video_filename,
            'frame_number': self.frame_number,
            'predictions': self.predictions,
            'confidence_threshold': self.confidence_threshold,
            'iou_threshold': self.iou_threshold,
            'processing_time': self.processing_time,
            'error': self.error,
            'model_version': self.model_version
        }

def init_db():
    try:
        Base.metadata.drop_all(engine)
        Base.metadata.create_all(engine)
        logger.info("Database tables recreated successfully")
    except Exception as e:
        logger.error(f"Error initializing database: {str(e)}")
        raise

init_db()