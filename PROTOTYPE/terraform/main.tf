# Terraform Main Configuration
# Phase 5: AWS Cloud Deployment for Project Isekai Beta
# 
# Initialize: terraform init
# Plan: terraform plan
# Apply: terraform apply
# Destroy: terraform destroy

terraform {
  required_version = ">= 1.0"
  required_providers {
    aws = {
      source  = "hashicorp/aws"
      version = "~> 5.0"
    }
  }

  # Uncomment for production to use S3 backend for state file
  # backend "s3" {
  #   bucket         = "isekai-terraform-state"
  #   key            = "beta/terraform.tfstate"
  #   region         = "us-east-1"
  #   encrypt        = true
  #   dynamodb_table = "terraform-locks"
  # }
}

provider "aws" {
  region = var.aws_region

  default_tags {
    tags = {
      Environment = var.environment
      Project     = var.project_name
      ManagedBy   = "Terraform"
      CreatedAt   = formatdate("YYYY-MM-DD", timestamp())
    }
  }
}

# ===== VARIABLES =====

variable "aws_region" {
  description = "AWS region for deployment"
  type        = string
  default     = "us-east-1"
}

variable "environment" {
  description = "Environment name (development, staging, production)"
  type        = string
  default     = "staging"
}

variable "project_name" {
  description = "Project name"
  type        = string
  default     = "isekai"
}

variable "app_name" {
  description = "Application name"
  type        = string
  default     = "isekai-api"
}

variable "instance_type" {
  description = "EC2 instance type for API servers"
  type        = string
  default     = "t3.large"
}

variable "db_instance_class" {
  description = "RDS instance class"
  type        = string
  default     = "db.t3.medium"
}

variable "min_size" {
  description = "Minimum number of EC2 instances in ASG"
  type        = number
  default     = 2
}

variable "max_size" {
  description = "Maximum number of EC2 instances in ASG"
  type        = number
  default     = 4
}

variable "admin_ip" {
  description = "Your IP address for SSH access"
  type        = string
  default     = "0.0.0.0/0" # Change for production security
}

# ===== OUTPUTS =====

output "alb_dns" {
  description = "DNS name of the Application Load Balancer"
  value       = aws_lb.main.dns_name
}

output "alb_arn" {
  description = "ARN of the Application Load Balancer"
  value       = aws_lb.main.arn
}

output "rds_endpoint" {
  description = "RDS PostgreSQL endpoint"
  value       = aws_db_instance.postgres.endpoint
}

output "rds_port" {
  description = "RDS PostgreSQL port"
  value       = aws_db_instance.postgres.port
}

output "asg_name" {
  description = "Auto Scaling Group name"
  value       = aws_autoscaling_group.api.name
}

output "ecr_repository_url" {
  description = "ECR repository URL for Docker image"
  value       = aws_ecr_repository.isekai.repository_url
}

output "cloudwatch_log_group_api" {
  description = "CloudWatch log group for API"
  value       = aws_cloudwatch_log_group.api.name
}

output "deployment_info" {
  description = "Quick summary of deployment"
  value = {
    alb_url             = "http://${aws_lb.main.dns_name}"
    api_security_group  = aws_security_group.api.id
    db_security_group   = aws_security_group.rds.id
    region              = var.aws_region
    instance_type       = var.instance_type
    db_instance_class   = var.db_instance_class
  }
}
