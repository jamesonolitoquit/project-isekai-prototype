# API Reference

## Base URL

**Local**: `http://localhost:5000`  
**Production**: `https://[your-railway-domain].railway.app`

---

## Health Check

```http
GET /api/health
```

**Response** (200 OK):
```json
{
  "status": "healthy",
  "timestamp": "2026-02-24T12:00:00Z",
  "uptime": 3600
}
```

---

## Authentication

### Login

```http
POST /api/auth/login
Content-Type: application/json

{
  "email": "user@example.com",
  "password": "password",
  "beta_key": "BETA-XXXX-XXXX-XXXX"
}
```

**Response** (200 OK):
```json
{
  "jwt_token": "eyJhbGc...",
  "user_id": "user_12345",
  "role": "admin",
  "expires_in": 86400
}
```

**Response** (401 Unauthorized):
```json
{
  "error": "Invalid credentials or beta key not activated"
}
```

---

## Admin Endpoints (Requires JWT + admin role)

All admin endpoints require header:
```
Authorization: Bearer {jwt_token}
```

### Create Moderation Action

```http
POST /api/admin/moderation/action
Content-Type: application/json
Authorization: Bearer {jwt_token}

{
  "player_id": "player_12345",
  "action": "ban",
  "reason": "rules violation - RWT",
  "duration_hours": 24
}
```

**Actions**: `ban` | `mute` | `warn` | `kick`

**Response** (201 Created):
```json
{
  "action_id": "action_67890",
  "player_id": "player_12345",
  "action": "ban",
  "applied_at": "2026-02-24T12:00:00Z",
  "broadcast": true
}
```

### Get Incidents

```http
GET /api/admin/incidents?limit=50&offset=0
Authorization: Bearer {jwt_token}
```

**Response** (200 OK):
```json
{
  "total": 150,
  "incidents": [
    {
      "id": "incident_001",
      "player_id": "player_12345",
      "type": "exploit_detected",
      "severity": "high",
      "description": "Duplicate gold transaction detected",
      "created_at": "2026-02-24T11:30:00Z",
      "status": "investigated"
    }
  ]
}
```

### Get Campaigns

```http
GET /api/admin/campaigns?status=active&limit=20
Authorization: Bearer {jwt_token}
```

**Response** (200 OK):
```json
{
  "campaigns": [
    {
      "id": "campaign_001",
      "name": "Returning Players - Week 1",
      "target_segment": "at_risk",
      "player_count": 34,
      "fired_at": "2026-02-24T10:00:00Z",
      "engagement_rate": 0.41
    }
  ]
}
```

---

## Real-Time Events (Socket.IO)

### Client Connection

```javascript
import io from 'socket.io-client';

const socket = io('http://localhost:5000', {
  auth: { token: jwt_token }
});

socket.on('connect', () => {
  console.log('✅ Connected to server');
});

socket.on('disconnect', () => {
  console.log('❌ Disconnected from server');
});

socket.on('error', (error) => {
  console.error('❌ Socket error:', error);
});
```

### M69 Events (Exploit Detection)

```javascript
// Exploit detected
socket.on('m69:incident-created', (data) => {
  console.log('🚨 Exploit detected:', data);
  // {
  //   incident_id: "incident_001",
  //   player_id: "player_12345",
  //   exploit_type: "gold_duplication",
  //   severity: "high",
  //   timestamp: "2026-02-24T12:00:00Z"
  // }
});

// Moderator action applied
socket.on('m69:ban-applied', (data) => {
  console.log('🚫 Player banned:', data);
  // {
  //   player_id: "player_12345",
  //   action: "ban",
  //   duration_hours: 24,
  //   reason: "exploit detected"
  // }
});
```

### M70 Events (Retention)

```javascript
// Campaign fired
socket.on('m70:campaign-fired', (data) => {
  console.log('📧 Campaign sent to players:', data);
  // {
  //   campaign_id: "campaign_001",
  //   player_count: 34,
  //   segment: "at_risk",
  //   campaign_type: "re_engagement_reward"
  // }
});

// Engagement score updated
socket.on('m70:engagement-score-updated', (data) => {
  console.log('💚 Engagement updated:', data);
  // {
  //   player_id: "player_12345",
  //   engagement_score: 0.75,
  //   churn_risk: "low",
  //   segment: "engaged"
  // }
});

// Player re-engaged
socket.on('m70:player-reengaged', (data) => {
  console.log('✨ Player returned:', data);
  // {
  //   player_id: "player_12345",
  //   last_offline_hours: 24,
  //   re_engagement_source: "campaign_001"
  // }
});
```

### Moderator Console Events

```javascript
// ModeratorConsole: Active incidents
socket.on('moderator:incidents-list', (data) => {
  // Panel shows all active incidents for moderation
});

// ModeratorConsole: New incident alert
socket.on('moderator:new-incident', (data) => {
  // Real-time alert of new exploit detection
});
```

---

## Metrics & Monitoring

### Prometheus Metrics

```http
GET /metrics
```

**Response** (200 OK, Prometheus format):
```
# HELP http_requests_total Total HTTP requests
# TYPE http_requests_total counter
http_requests_total{method="GET",status="200"} 1234
http_requests_total{method="POST",status="201"} 567

# HELP http_request_duration_ms HTTP request latency
# TYPE http_request_duration_ms histogram
http_request_duration_ms_bucket{le="10"} 500
http_request_duration_ms_bucket{le="50"} 800
http_request_duration_ms_bucket{le="100"} 950

# HELP nodejs_memory_usage_bytes Node.js memory usage
# TYPE nodejs_memory_usage_bytes gauge
nodejs_memory_usage_bytes{type="heap_used"} 15728640
nodejs_memory_usage_bytes{type="external"} 2097152
```

---

## Error Responses

### 400 Bad Request
```json
{
  "error": "Invalid request parameters",
  "details": ["email is required", "password must be 8+ characters"]
}
```

### 401 Unauthorized
```json
{
  "error": "Unauthorized",
  "message": "JWT token expired or invalid"
}
```

### 403 Forbidden
```json
{
  "error": "Forbidden",
  "message": "Admin role required for this endpoint"
}
```

### 500 Internal Server Error
```json
{
  "error": "Internal Server Error",
  "request_id": "req_12345"
}
```

---

## Rate Limiting

API endpoints are rate-limited:
- **Login**: 10 requests per minute per IP
- **Admin endpoints**: 100 requests per minute per user
- **Health check**: Unlimited

Headers returned:
```
X-RateLimit-Limit: 100
X-RateLimit-Remaining: 95
X-RateLimit-Reset: 1614160000
```

---

## WebSocket Reconnection

Socket.IO automatically handles reconnection:
- Reconnect attempts: Every 1-5 seconds
- Max backoff: 30 seconds
- Automatic: No code needed

---

## Example: Complete Integration

```javascript
// 1. Connect and authenticate
const socket = io('http://localhost:5000', {
  auth: { token: jwt_token }
});

socket.on('connect', () => {
  console.log('✅ Connected to server');
});

// 2. Listen for M69 incidents
socket.on('m69:incident-created', async (incident) => {
  console.log('🚨 Exploit detected:', incident);
  
  // 3. Take moderation action via HTTP API
  const response = await fetch('/api/admin/moderation/action', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${jwt_token}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      player_id: incident.player_id,
      action: 'ban',
      reason: `${incident.exploit_type} detected`,
      duration_hours: 24
    })
  });
  
  console.log('✅ Ban applied:', await response.json());
});

// 4. Listen for M70 campaign results
socket.on('m70:campaign-fired', (campaign) => {
  console.log('📊 Campaign metrics:', {
    players_targeted: campaign.player_count,
    engagement_rate: campaign.engagement_rate
  });
});
```

---

## Support & Documentation

- **Local Testing**: `npm test -- --testPathPattern='m69m70'`
- **API Logs**: Check `http://localhost:5000/logs` (if enabled)
- **Issues**: GitHub issue tracker
