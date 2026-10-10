FROM node:22.18.0-bookworm-slim AS node
FROM python:3.10.19-slim-bookworm
COPY --from=node /usr/local/bin/node /usr/local/bin/node
RUN apt-get update && apt-get install -y --no-install-recommends git libsndfile1 libstdc++6 libatomic1 libgomp1 ca-certificates \
    && rm -rf /var/lib/apt/lists/*
WORKDIR /app
COPY package.json package.json
COPY server/audio-analysis/requirements.txt server/audio-analysis/requirements.txt
RUN pip install --no-cache-dir torch==2.0.1+cpu torchaudio==2.0.2+cpu --index-url https://download.pytorch.org/whl/cpu --extra-index-url https://pypi.org/simple \
    && pip install --no-cache-dir -r server/audio-analysis/requirements.txt
COPY server/audio-analysis/service.py server/audio-analysis/analyze.py server/audio-analysis/
COPY server/lead-note-selection.ts server/primary-melody-tracker.ts server/
COPY scripts/import-beat-analysis.mjs scripts/select-lead-source.mjs scripts/extract-low-pulses.mjs scripts/
COPY src/features/music/event-track.ts src/features/music/lead-events.ts src/features/music/
COPY extensions/kanban-music/media-asset.js extensions/kanban-music/beat-detector.js extensions/kanban-music/
RUN useradd --uid 10001 --create-home analysis && mkdir /data /models && chown analysis /data /models
USER analysis
ENV BEAT_ANALYSIS_DIRECTORY=/data BEAT_ANALYSIS_BIND=0.0.0.0 PORT=47700 TORCH_HOME=/models
EXPOSE 47700
CMD ["python", "server/audio-analysis/service.py"]
