
# 1. Environment & Framework Setup
# Base image
FROM python:3.10-slim

# Set environment variables
ENV PYTHONUNBUFFERED 1

# Install system dependencies
RUN apt-get update && apt-get install -y \
    ffmpeg \
    git \
    libsndfile1 \
    fonts-dejavu-core \
    && rm -rf /var/lib/apt/lists/*

# Set working directory
WORKDIR /app

# Create and set permissions for output directory
RUN mkdir -p /app/output && chmod 777 /app/output

# Copy requirements and install Python packages
COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

# Copy the rest of the application code
COPY . .

# Expose the port the app runs on
EXPOSE 7860

# Run the application
CMD ["uvicorn", "app:app", "--host", "0.0.0.0", "--port", "7860"]

