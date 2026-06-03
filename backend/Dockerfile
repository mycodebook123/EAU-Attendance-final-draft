FROM python:3.11-slim

WORKDIR /app

# Install dependencies
COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

# Copy project files
COPY . .

EXPOSE 8000

# Run Django with gunicorn (production server)
CMD ["gunicorn", "sams.wsgi:application", "--bind", "0.0.0.0:8000"]