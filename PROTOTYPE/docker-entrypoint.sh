#!/bin/sh
# docker-entrypoint.sh - Phase 23 Task 2
# Ensures database is ready before starting the application

set -e

echo "🔄 Waiting for PostgreSQL to be ready..."

# Wait for PostgreSQL to be accessible
until pg_isready -h "$DB_HOST" -p "${DB_PORT:-5432}" -U "$DB_USER"; do
  echo "⏳ PostgreSQL is unavailable - sleeping"
  sleep 2
done

echo "✅ PostgreSQL is ready!"

# Run database migrations (if migration script exists)
if [ -f /app/scripts/migrate.sh ]; then
  echo "🔄 Running database migrations..."
  sh /app/scripts/migrate.sh
  echo "✅ Migrations complete"
fi

echo "🚀 Starting application..."

# Execute the main command
exec "$@"
