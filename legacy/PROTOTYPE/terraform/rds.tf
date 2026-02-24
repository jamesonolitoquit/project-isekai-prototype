# Terraform RDS Module
# PostgreSQL 14 database with high availability configuration

# ===== RDS SECURITY GROUP =====

resource "aws_security_group" "rds" {
  name        = "${var.project_name}-rds-sg"
  description = "Security group for RDS PostgreSQL"

  ingress {
    from_port       = 5432
    to_port         = 5432
    protocol        = "tcp"
    security_groups = [aws_security_group.api.id]
    description     = "Allow PostgreSQL from API servers"
  }

  egress {
    from_port   = 0
    to_port     = 0
    protocol    = "-1"
    cidr_blocks = ["0.0.0.0/0"]
    description = "Allow outbound traffic"
  }

  tags = {
    Name = "${var.project_name}-rds-sg"
  }
}

# ===== RDS PARAMETER GROUP =====

resource "aws_db_parameter_group" "postgres" {
  family      = "postgres14"
  name        = "${var.project_name}-postgres-params"
  description = "Custom parameter group for Isekai PostgreSQL"

  parameter {
    name  = "max_connections"
    value = "1000"
  }

  parameter {
    name  = "shared_buffers"
    value = "{LEAST(DBInstanceClassMemory/32000,107374182400)}"
  }

  parameter {
    name  = "effective_cache_size"
    value = "{LEAST(DBInstanceClassMemory/4000,68719476736)}"
  }

  parameter {
    name  = "work_mem"
    value = "{LEAST(DBInstanceClassMemory/300000,1048576)}"
  }

  parameter {
    name  = "maintenance_work_mem"
    value = "{LEAST(DBInstanceClassMemory/16000,2147483647)}"
  }

  parameter {
    name  = "random_page_cost"
    value = "1.1"
  }

  tags = {
    Name = "${var.project_name}-postgres-params"
  }
}

# ===== RDS SUBNET GROUP =====

# Create VPC if needed (simplified; assumes default VPC exists)
resource "aws_db_subnet_group" "postgres" {
  name       = "${var.project_name}-db-subnet"
  subnet_ids = data.aws_subnets.default.ids

  tags = {
    Name = "${var.project_name}-db-subnet"
  }
}

data "aws_subnets" "default" {
  filter {
    name   = "default-for-az"
    values = ["true"]
  }
}

# ===== RDS INSTANCE =====

resource "aws_db_instance" "postgres" {
  identifier            = "${var.project_name}-postgres"
  engine                = "postgres"
  engine_version        = "14.7"
  instance_class        = var.db_instance_class
  allocated_storage     = 100
  storage_type          = "gp3"
  storage_encrypted     = true
  multi_az              = true
  db_name               = "isekai_beta"
  username              = "isekaiadmin"
  password              = random_password.db_password.result
  parameter_group_name  = aws_db_parameter_group.postgres.name
  db_subnet_group_name  = aws_db_subnet_group.postgres.name
  vpc_security_group_ids = [aws_security_group.rds.id]

  # Backup configuration
  backup_retention_period = 30
  backup_window          = "03:00-04:00"
  maintenance_window     = "sun:04:00-sun:05:00"
  copy_tags_to_snapshot  = true

  # Enhanced monitoring
  monitoring_interval          = 60
  monitoring_role_arn          = aws_iam_role.rds_monitoring.arn
  enabled_cloudwatch_logs_exports = ["postgresql"]

  # Performance and security
  deletion_protection       = true
  skip_final_snapshot       = false
  final_snapshot_identifier = "${var.project_name}-postgres-final-snapshot-${formatdate("YYYY-MM-DD-hhmm", timestamp())}"

  depends_on = [aws_iam_role_policy.rds_monitoring]

  tags = {
    Name = "${var.project_name}-postgres"
  }
}

# ===== RDS MONITORING IAM ROLE =====

resource "aws_iam_role" "rds_monitoring" {
  name = "${var.project_name}-rds-monitoring"

  assume_role_policy = jsonencode({
    Version = "2012-10-17"
    Statement = [
      {
        Action = "sts:AssumeRole"
        Effect = "Allow"
        Principal = {
          Service = "monitoring.rds.amazonaws.com"
        }
      }
    ]
  })
}

resource "aws_iam_role_policy_attachment" "rds_monitoring" {
  role       = aws_iam_role.rds_monitoring.name
  policy_arn = "arn:aws:iam::aws:policy/service-role/AmazonRDSEnhancedMonitoringRole"
}

resource "aws_iam_role_policy" "rds_monitoring" {
  name = "${var.project_name}-rds-monitoring-policy"
  role = aws_iam_role.rds_monitoring.id

  policy = jsonencode({
    Version = "2012-10-17"
    Statement = [
      {
        Effect = "Allow"
        Action = [
          "logs:CreateLogGroup",
          "logs:CreateLogStream",
          "logs:PutLogEvents"
        ]
        Resource = "arn:aws:logs:*:*:*"
      }
    ]
  })
}

# ===== RANDOM PASSWORD GENERATION =====

resource "random_password" "db_password" {
  length  = 32
  special = true
  override_special = "!#$%&*()-_=+[]{}<>:?"
}

# ===== OUTPUTS =====

output "db_endpoint" {
  description = "RDS endpoint (host:port)"
  value       = aws_db_instance.postgres.endpoint
}

output "db_address" {
  description = "RDS endpoint address only"
  value       = aws_db_instance.postgres.address
}

output "db_port" {
  description = "RDS port"
  value       = aws_db_instance.postgres.port
}

output "db_username" {
  description = "RDS master username"
  value       = aws_db_instance.postgres.username
}

output "db_password" {
  description = "RDS master password (store in AWS Secrets Manager)"
  value       = random_password.db_password.result
  sensitive   = true
}
