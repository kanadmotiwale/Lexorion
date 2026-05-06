import os
from urllib.parse import quote_plus
from sqlalchemy import create_engine, Column, String, Integer, DateTime, Text, JSON
from sqlalchemy.ext.declarative import declarative_base
from sqlalchemy.orm import sessionmaker
from pgvector.sqlalchemy import Vector
from datetime import datetime

DB_HOST = os.getenv("DB_HOST", "")
DB_PORT = os.getenv("DB_PORT", "5432")
DB_NAME = os.getenv("DB_NAME", "postgres")
DB_USER = os.getenv("DB_USER", "postgres")
DB_PASS = quote_plus(os.getenv("DB_PASS", ""))

DATABASE_URL = f"postgresql://{DB_USER}:{DB_PASS}@{DB_HOST}:{DB_PORT}/{DB_NAME}"

engine = create_engine(DATABASE_URL, pool_pre_ping=True)
SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)
Base = declarative_base()


class Document(Base):
    __tablename__ = "documents"
    __table_args__ = {"extend_existing": True}

    id           = Column(String, primary_key=True)
    user_id      = Column(String, nullable=False, default="")
    filename     = Column(String, nullable=False)
    file_type    = Column(String, nullable=False)
    file_size    = Column(Integer, nullable=False)
    total_chunks = Column(Integer, default=0)
    status       = Column(String, default="processing")
    created_at   = Column(DateTime(timezone=True), default=datetime.utcnow)


class Chunk(Base):
    __tablename__ = "chunks"
    __table_args__ = {"extend_existing": True}

    id          = Column(String, primary_key=True)
    document_id = Column(String, nullable=False)
    chunk_index = Column(Integer, nullable=False)
    text        = Column(Text, nullable=False)
    token_count = Column(Integer, default=0)
    embedding   = Column(Vector(384))
    created_at  = Column(DateTime(timezone=True), default=datetime.utcnow)


class Conversation(Base):
    __tablename__ = "conversations"
    __table_args__ = {"extend_existing": True}

    id         = Column(String, primary_key=True)
    user_id    = Column(String, nullable=False)
    title      = Column(String, default="New Chat")
    created_at = Column(DateTime(timezone=True), default=datetime.utcnow)
    updated_at = Column(DateTime(timezone=True), default=datetime.utcnow)


class Message(Base):
    __tablename__ = "messages"
    __table_args__ = {"extend_existing": True}

    id              = Column(String, primary_key=True)
    conversation_id = Column(String, nullable=False)
    role            = Column(String, nullable=False)   # "user" | "assistant"
    content         = Column(Text, nullable=False)
    sources         = Column(JSON, default=list)
    created_at      = Column(DateTime(timezone=True), default=datetime.utcnow)


def init_db():
    # Create all tables that don't already exist
    Base.metadata.create_all(engine)
    # Verify the connection is healthy
    with engine.connect() as conn:
        conn.execute(__import__("sqlalchemy").text("SELECT 1"))


def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()
