# Terraform Monitoring & Observability Module
# CloudWatch logs, alarms, dashboards, and ECR

# ===== ECR REPOSITORY =====

resource "aws_ecr_repository" "isekai" {
  name                 = var.project_name
  image_tag_mutability = "MUTABLE"

  image_scanning_configuration {
    scan_on_push = true
  }

  encryption_configuration {
    encryption_type = "AES256"
  }

  tags = {
    Name = "${var.project_name}-ecr"
  }
}

resource "aws_ecr_repository_policy" "isekai" {
  repository = aws_ecr_repository.isekai.name

  policy = jsonencode({
    Version = "2012-10-17"
    Statement = [
      {
        Effect = "Allow"
        Principal = {
          AWS = "arn:aws:iam::${data.aws_caller_identity.current.account_id}:root"
        }
        Action = [
          "ecr:GetDownloadUrlForLayer",
          "ecr:BatchGetImage",
          "ecr:PutImage",
          "ecr:InitiateLayerUpload",
          "ecr:UploadLayerPart",
          "ecr:CompleteLayerUpload"
        ]
      }
    ]
  })
}

data "aws_caller_identity" "current" {}

# ===== REDIS ELASTICACHE =====

resource "aws_security_group" "redis" {
  name        = "${var.project_name}-redis-sg"
  description = "Security group for Redis"

  ingress {
    from_port       = 6379
    to_port         = 6379
    protocol        = "tcp"
    security_groups = [aws_security_group.api.id]
    description     = "Allow Redis from API servers"
  }

  egress {
    from_port   = 0
    to_port     = 0
    protocol    = "-1"
    cidr_blocks = ["0.0.0.0/0"]
    description = "Allow outbound"
  }

  tags = {
    Name = "${var.project_name}-redis-sg"
  }
}

resource "aws_elasticache_subnet_group" "redis" {
  name       = "${var.project_name}-redis-subnet"
  subnet_ids = data.aws_subnets.default.ids
}

resource "aws_elasticache_cluster" "redis" {
  cluster_id           = "${var.project_name}-redis"
  engine               = "redis"
  node_type            = "cache.t3.micro"
  num_cache_nodes      = 1
  parameter_group_name = "default.redis7"
  engine_version       = "7.0"
  port                 = 6379
  subnet_group_name    = aws_elasticache_subnet_group.redis.name
  security_group_ids   = [aws_security_group.redis.id]

  at_rest_encryption_enabled = true
  transit_encryption_enabled = false # Set to true with auth for production

  maintenance_window = "sun:03:00-sun:04:00"
  snapshot_window   = "02:00-03:00"
  snapshot_retention_limit = 5

  tags = {
    Name = "${var.project_name}-redis"
  }
}

# ===== CLOUDWATCH LOG GROUPS =====

resource "aws_cloudwatch_log_group" "api" {
  name              = "/isekai/api"
  retention_in_days = 30

  tags = {
    Name = "${var.project_name}-api-logs"
  }
}

resource "aws_cloudwatch_log_group" "nginx" {
  name              = "/isekai/nginx"
  retention_in_days = 30

  tags = {
    Name = "${var.project_name}-nginx-logs"
  }
}

# ===== CLOUDWATCH ALARMS =====

resource "aws_cloudwatch_metric_alarm" "alb_target_latency" {
  alarm_name          = "${var.project_name}-alb-latency-high"
  comparison_operator = "GreaterThanThreshold"
  evaluation_periods  = "2"
  metric_name         = "TargetResponseTime"
  namespace           = "AWS/ApplicationELB"
  period              = "60"
  statistic           = "Average"
  threshold           = "0.05" # 50ms
  alarm_description   = "Alert if ALB target latency exceeds 50ms"
  treat_missing_data  = "notBreaching"

  dimensions = {
    LoadBalancer = aws_lb.main.arn_suffix
  }
}

resource "aws_cloudwatch_metric_alarm" "alb_target_unhealthy" {
  alarm_name          = "${var.project_name}-alb-unhealthy-targets"
  comparison_operator = "GreaterThanThreshold"
  evaluation_periods  = "1"
  metric_name         = "UnHealthyHostCount"
  namespace           = "AWS/ApplicationELB"
  period              = "60"
  statistic           = "Average"
  threshold           = "0"
  alarm_description   = "Alert if any targets become unhealthy"
  treat_missing_data  = "notBreaching"

  dimensions = {
    LoadBalancer  = aws_lb.main.arn_suffix
    TargetGroup   = aws_lb_target_group.api.arn_suffix
  }
}

resource "aws_cloudwatch_metric_alarm" "rds_cpu" {
  alarm_name          = "${var.project_name}-rds-cpu-high"
  comparison_operator = "GreaterThanThreshold"
  evaluation_periods  = "2"
  metric_name         = "CPUUtilization"
  namespace           = "AWS/RDS"
  period              = "300"
  statistic           = "Average"
  threshold           = "70"
  alarm_description   = "Alert if RDS CPU exceeds 70%"
  treat_missing_data  = "notBreaching"

  dimensions = {
    DBInstanceIdentifier = aws_db_instance.postgres.id
  }
}

resource "aws_cloudwatch_metric_alarm" "rds_connections" {
  alarm_name          = "${var.project_name}-rds-connections-high"
  comparison_operator = "GreaterThanThreshold"
  evaluation_periods  = "2"
  metric_name         = "DatabaseConnections"
  namespace           = "AWS/RDS"
  period              = "300"
  statistic           = "Average"
  threshold           = "800"
  alarm_description   = "Alert if database connections exceed 800"
  treat_missing_data  = "notBreaching"

  dimensions = {
    DBInstanceIdentifier = aws_db_instance.postgres.id
  }
}

resource "aws_cloudwatch_metric_alarm" "redis_cpu" {
  alarm_name          = "${var.project_name}-redis-cpu-high"
  comparison_operator = "GreaterThanThreshold"
  evaluation_periods  = "2"
  metric_name         = "CPUUtilization"
  namespace           = "AWS/ElastiCache"
  period              = "300"
  statistic           = "Average"
  threshold           = "75"
  alarm_description   = "Alert if Redis CPU exceeds 75%"
  treat_missing_data  = "notBreaching"

  dimensions = {
    CacheClusterId = aws_elasticache_cluster.redis.id
  }
}

# ===== CLOUDWATCH DASHBOARD =====

resource "aws_cloudwatch_dashboard" "isekai" {
  dashboard_name = "${var.project_name}-dashboard"

  dashboard_body = jsonencode({
    widgets = [
      {
        type = "metric"
        properties = {
          metrics = [
            ["AWS/ApplicationELB", "TargetResponseTime", { stat = "Average" }],
            ["AWS/ApplicationELB", "RequestCount", { stat = "Sum" }],
            ["AWS/RDS", "CPUUtilization", { stat = "Average" }],
            ["AWS/RDS", "DatabaseConnections", { stat = "Average" }],
            ["AWS/ElastiCache", "CPUUtilization", { stat = "Average" }],
            ["AWS/ElastiCache", "NetworkBytesIn", { stat = "Sum" }]
          ]
          period = 300
          stat   = "Average"
          region = var.aws_region
          title  = "Isekai Beta Metrics"
        }
      }
    ]
  })
}

# ===== OUTPUTS =====

output "ecr_repository_url" {
  description = "ECR repository URL"
  value       = aws_ecr_repository.isekai.repository_url
}

output "ecr_repository_name" {
  description = "ECR repository name"
  value       = aws_ecr_repository.isekai.name
}

output "redis_endpoint" {
  description = "Redis cluster endpoint"
  value       = aws_elasticache_cluster.redis.cache_nodes[0].address
}

output "redis_port" {
  description = "Redis port"
  value       = aws_elasticache_cluster.redis.port
}

output "cloudwatch_log_group_api" {
  description = "CloudWatch log group for API"
  value       = aws_cloudwatch_log_group.api.name
}

output "cloudwatch_dashboard_url" {
  description = "CloudWatch dashboard URL"
  value       = "https://console.aws.amazon.com/cloudwatch/home?region=${var.aws_region}#dashboards:name=${aws_cloudwatch_dashboard.isekai.dashboard_name}"
}
