# Multi-stage Dockerfile for Cursor Telemetry SDK

# Stage 1: Build JavaScript SDK
FROM node:20-alpine AS js-builder
WORKDIR /app/javascript
COPY javascript/package*.json ./
RUN npm ci --only=production
COPY javascript/src ./src
COPY javascript/tsconfig.json ./
RUN npm run build

# Stage 2: Build Python SDK
FROM python:3.11-slim AS python-builder
WORKDIR /app/python
COPY python/setup.py python/pyproject.toml ./
COPY python/cursor_telemetry ./cursor_telemetry
RUN pip install --no-cache-dir build && \
    python -m build

# Stage 3: Runtime image
FROM python:3.11-slim
LABEL maintainer="Cursor Telemetry Team <team@cursor-telemetry.com>"
LABEL description="Cursor Telemetry SDK - Official SDK for Cursor Telemetry API"

# Install system dependencies
RUN apt-get update && apt-get install -y \
    curl \
    git \
    && rm -rf /var/lib/apt/lists/*

# Install Node.js for JavaScript SDK
RUN curl -fsSL https://deb.nodesource.com/setup_20.x | bash - && \
    apt-get install -y nodejs

# Create app directory
WORKDIR /app

# Copy built JavaScript SDK
COPY --from=js-builder /app/javascript/dist ./javascript/dist
COPY --from=js-builder /app/javascript/package.json ./javascript/
COPY --from=js-builder /app/javascript/node_modules ./javascript/node_modules

# Install Python SDK
COPY --from=python-builder /app/python/dist/*.whl ./
RUN pip install --no-cache-dir *.whl && rm *.whl

# Copy examples and documentation
COPY examples ./examples
COPY README.md ./
COPY LICENSE ./

# Create non-root user
RUN useradd -m -u 1000 sdkuser && \
    chown -R sdkuser:sdkuser /app
USER sdkuser

# Set environment variables
ENV NODE_PATH=/app/javascript/dist
ENV PYTHONPATH=/app/python

# Health check
HEALTHCHECK --interval=30s --timeout=10s --start-period=5s --retries=3 \
    CMD python -c "import cursor_telemetry; print('SDK is healthy')" || exit 1

# Default command
CMD ["python", "-c", "import cursor_telemetry; print('Cursor Telemetry SDK is ready!')"]
