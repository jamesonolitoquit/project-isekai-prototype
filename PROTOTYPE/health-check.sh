#!/bin/bash
# PHASE 5A-LOCAL-TEST.1: Comprehensive System Health Check

echo "=================================================="
echo "  PHASE 5A-LOCAL-TEST.1: SYSTEM HEALTH CHECK"
echo "=================================================="
echo ""
echo "Timestamp: $(date)"
echo ""

# Test 1: API Server
echo "TEST 1: API Server (port 5000)"
echo "==============================="
API_RESPONSE=$(curl -s -w "\n%{http_code}" http://localhost:5000/api/health 2>&1)
API_CODE=$(echo "$API_RESPONSE" | tail -1)
API_BODY=$(echo "$API_RESPONSE" | head -1)

if [ "$API_CODE" = "200" ]; then
    echo "✅ API responding on port 5000"
    echo "   Status Code: $API_CODE"
    echo "   Response: $API_BODY"
else
    echo "❌ API not responding correctly"
    echo "   Status Code: $API_CODE"
fi
echo ""

# Test 2: React App
echo "TEST 2: React Application (port 3000)"
echo "======================================"
REACT_RESPONSE=$(curl -s -w "\n%{http_code}" http://localhost:3000/ 2>&1 | tail -1)
REACT_BODY=$(curl -s http://localhost:3000/ 2>&1 | head -5)

if [ "$REACT_RESPONSE" = "200" ]; then
    echo "✅ React app responding on port 3000"
    echo "   Status Code: $REACT_RESPONSE"
else
    echo "❌ React app not responding"
    echo "   Status Code: $REACT_RESPONSE"
fi
echo ""

# Test 3: PostgreSQL
echo "TEST 3: PostgreSQL Database"
echo "==========================="
PG_VERSION=$(psql -U isekai -d isekai -h localhost -c "SELECT version();" 2>&1)

if echo "$PG_VERSION" | grep -q "PostgreSQL"; then
    echo "✅ PostgreSQL connected"
    echo "   $PG_VERSION"
else
    echo "❌ PostgreSQL connection failed"
fi
echo ""

# Test 4: Redis
echo "TEST 4: Redis Cache"
echo "==================="
REDIS_PING=$(redis-cli ping 2>&1)

if [ "$REDIS_PING" = "PONG" ]; then
    echo "✅ Redis connected"
    echo "   Response: $REDIS_PING"
else
    echo "❌ Redis connection failed"
    echo "   Response: $REDIS_PING"
fi
echo ""

# Test 5: Socket.IO Server
echo "TEST 5: Socket.IO Server (port 3002)"
echo "====================================="
SOCKET_RESPONSE=$(curl -s -w "\n%{http_code}" http://localhost:3002/ 2>&1 | tail -1)

if [ "$SOCKET_RESPONSE" = "200" ] || [ "$SOCKET_RESPONSE" = "400" ]; then
    echo "✅ Socket.IO port 3002 responding"
    echo "   Status Code: $SOCKET_RESPONSE (expected for Socket.IO)"
else
    echo "⚠️  Socket.IO may not be responding on port 3002"
    echo "   Status Code: $SOCKET_RESPONSE"
fi
echo ""

# Test 6: Database Tables
echo "TEST 6: Database Table Status"
echo "============================="
TABLE_COUNT=$(psql -U isekai -d isekai -h localhost -c "
SELECT COUNT(*) as table_count FROM information_schema.tables 
WHERE table_schema = 'public';
" 2>&1 | grep -oE '[0-9]+' | head -1)

echo "Public tables in database: $TABLE_COUNT"

if [ "$TABLE_COUNT" -gt 0 ]; then
    echo "✅ Database schema initialized"
    
    # Get table names
    echo ""
    echo "Tables found:"
    psql -U isekai -d isekai -h localhost -c "
    SELECT table_name FROM information_schema.tables 
    WHERE table_schema = 'public' 
    ORDER BY table_name;
    " 2>&1 | tail -n +3
else
    echo "⚠️  No tables found in database"
fi
echo ""

# Summary
echo "=================================================="
echo "  HEALTH CHECK SUMMARY"
echo "=================================================="
echo ""

SUMMARY_PASS=0
SUMMARY_TOTAL=6

[ "$API_CODE" = "200" ] && SUMMARY_PASS=$((SUMMARY_PASS + 1)) || echo "❌ API Server: FAILED"
[ "$REACT_RESPONSE" = "200" ] && SUMMARY_PASS=$((SUMMARY_PASS + 1)) || echo "❌ React App: FAILED"
echo "$PG_VERSION" | grep -q "PostgreSQL" && SUMMARY_PASS=$((SUMMARY_PASS + 1)) || echo "❌ PostgreSQL: FAILED"
[ "$REDIS_PING" = "PONG" ] && SUMMARY_PASS=$((SUMMARY_PASS + 1)) || echo "❌ Redis: FAILED"
[ "$TABLE_COUNT" -gt 0 ] && SUMMARY_PASS=$((SUMMARY_PASS + 1)) || echo "❌ Database Schema: FAILED"

echo ""
echo "Overall Status: $SUMMARY_PASS/$SUMMARY_TOTAL systems operational"
echo ""

if [ $SUMMARY_PASS -eq $SUMMARY_TOTAL ]; then
    echo "✅ ALL SYSTEMS HEALTHY - READY FOR TESTING"
    exit 0
else
    echo "⚠️  Some systems need attention"
    exit 1
fi
