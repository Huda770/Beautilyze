FROM python:3.13-slim

ENV PYTHONDONTWRITEBYTECODE=1 \
    PYTHONUNBUFFERED=1 \
    DATABASE_PATH=/data/skincare.db \
    PORT=8080

WORKDIR /app
COPY requirements-prod.txt .
RUN pip install --no-cache-dir -r requirements-prod.txt

COPY app.py accounts.py explanations.py products.py recommend.py setup_db.py \
     class_names.json RecLogic.csv skin_type_model.pth ./

EXPOSE 8080
# One worker keeps SQLite writes and the in-memory login limiter in one process.
CMD exec gunicorn app:app --bind 0.0.0.0:${PORT} --workers 1 --threads 4 --timeout 120
