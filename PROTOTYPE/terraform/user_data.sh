#!/bin/bash
# EC2 User Data Script for Isekai API Servers
# This runs when an EC2 instance is launched from the launch template

set -e

# Update system packages
yum update -y
yum install -y docker git curl jq

# Start Docker daemon
systemctl start docker
systemctl enable docker

# Create app directory
mkdir -p /opt/isekai
cd /opt/isekai

# Configure environment variables
cat > /opt/isekai/app.env << 'EOF'
NODE_ENV=production
DATABASE_URL=${db_endpoint}
REDIS_URL=${redis_url}
JWT_SECRET=$(openssl rand -base64 32)
SOCKET_IO_PORT=3002
HTTP_PORT=5000
LOG_LEVEL=info
MAX_PLAYERS=500
ENABLE_CORS=true
CORS_ORIGIN=https://isekai.game
EOF

# Pull Docker image from ECR
$(aws ecr get-login-password --region ${AWS_REGION} | docker login --username AWS --password-stdin ${ecr_repo})
docker pull ${ecr_repo}:latest

# Start Docker container
docker run -d \
  --name isekai-api \
  --restart always \
  -p 5000:5000 \
  -p 3002:3002 \
  --env-file /opt/isekai/app.env \
  ${ecr_repo}:latest

# Log startup
echo "Isekai API container started at $(date)" >> /var/log/startup.log

# Configure CloudWatch logs
yum install -y amazon-cloudwatch-agent
cat > /opt/aws/amazon-cloudwatch-agent/etc/amazon-cloudwatch-agent.json << 'EOF'
{
  "agent": {
    "metrics_collection_interval": 60
  },
  "logs": {
    "logs_collected": {
      "files": {
        "collect_list": [
          {
            "file_path": "/var/log/docker",
            "log_group_name": "/isekai/api",
            "log_stream_name": "{instance_id}"
          }
        ]
      }
    }
  }
}
EOF

/opt/aws/amazon-cloudwatch-agent/bin/amazon-cloudwatch-agent-ctl \
  -a fetch-config \
  -m ec2 \
  -s \
  -c file:/opt/aws/amazon-cloudwatch-agent/etc/amazon-cloudwatch-agent.json
