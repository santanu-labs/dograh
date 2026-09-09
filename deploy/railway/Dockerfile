# Overlay Cloudflare TURN support onto the published API image so Railway
# does not have to rebuild pipecat/ffmpeg from source.
FROM dograhai/dograh-api:1.45.0

COPY --chown=dograh:dograh ./api/constants.py /app/api/constants.py
COPY --chown=dograh:dograh ./api/routes/turn_credentials.py /app/api/routes/turn_credentials.py
COPY --chown=dograh:dograh ./api/routes/webrtc_signaling.py /app/api/routes/webrtc_signaling.py
COPY --chown=dograh:dograh ./api/routes/public_embed.py /app/api/routes/public_embed.py
COPY --chown=dograh:dograh ./api/routes/main.py /app/api/routes/main.py
COPY --chown=dograh:dograh ./api/services/turn /app/api/services/turn
