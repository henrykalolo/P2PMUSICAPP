# Multi-region WebTorrent Tracker Deployment
# Terraform configuration for global tracker infrastructure

terraform {
  required_providers {
    aws = {
      source  = "hashicorp/aws"
      version = "~> 5.0"
    }
  }
  
  backend "s3" {
    bucket = "p2p-music-terraform-state"
    key    = "trackers/terraform.tfstate"
    region = "us-east-1"
  }
}

# Provider configurations for each region
provider "aws" {
  alias  = "us_east"
  region = "us-east-1"
}

provider "aws" {
  alias  = "eu_west"
  region = "eu-west-1"
}

provider "aws" {
  alias  = "ap_southeast"
  region = "ap-southeast-1"
}

provider "aws" {
  alias  = "sa_east"
  region = "sa-east-1"
}

# Variables
variable "tracker_port" {
  description = "Port for WebTorrent tracker"
  default     = 8000
}

variable "instance_type" {
  description = "EC2 instance type for trackers"
  default     = "c6i.xlarge"
}

variable "regions" {
  description = "Regions to deploy trackers"
  type        = map(string)
  default = {
    us-east-1      = "us_east"
    eu-west-1      = "eu_west"
    ap-southeast-1 = "ap_southeast"
    sa-east-1      = "sa_east"
  }
}

# Data source for Ubuntu AMI
data "aws_ami" "ubuntu" {
  for_each = var.regions
  
  provider = aws[each.value]
  
  most_recent = true
  owners      = ["099720109477"] # Canonical
  
  filter {
    name   = "name"
    values = ["ubuntu/images/hvm-ssd/ubuntu-24.04-amd64-server-*"]
  }
  
  filter {
    name   = "virtualization-type"
    values = ["hvm"]
  }
}

# Security group for trackers
resource "aws_security_group" "tracker" {
  for_each = var.regions
  
  provider = aws[each.value]
  
  name_prefix = "tracker-"
  description = "Security group for WebTorrent tracker"
  
  # WebSocket tracker port
  ingress {
    from_port   = var.tracker_port
    to_port     = var.tracker_port
    protocol    = "tcp"
    cidr_blocks = ["0.0.0.0/0"]
  }
  
  # Gossip protocol port
  ingress {
    from_port   = 8001
    to_port     = 8001
    protocol    = "tcp"
    cidr_blocks = ["0.0.0.0/0"]
  }
  
  # Health check port
  ingress {
    from_port   = 8080
    to_port     = 8080
    protocol    = "tcp"
    cidr_blocks = ["0.0.0.0/0"]
  }
  
  # SSH access (restrict to bastion host in production)
  ingress {
    from_port   = 22
    to_port     = 22
    protocol    = "tcp"
    cidr_blocks = ["0.0.0.0/0"]
  }
  
  egress {
    from_port   = 0
    to_port     = 0
    protocol    = "-1"
    cidr_blocks = ["0.0.0.0/0"]
  }
  
  tags = {
    Name = "tracker-sg-${each.key}"
  }
}

# Tracker EC2 instances
resource "aws_instance" "tracker" {
  for_each = var.regions
  
  provider = aws[each.value]
  
  ami                    = data.aws_ami.ubuntu[each.key].id
  instance_type          = var.instance_type
  vpc_security_group_ids = [aws_security_group.tracker[each.key].id]
  
  user_data = templatefile("${path.module}/tracker-setup.sh", {
    region       = each.key
    tracker_port = var.tracker_port
    gossip_port  = 8001
    health_port  = 8080
  })
  
  root_block_device {
    volume_size = 50
    volume_type = "gp3"
    encrypted   = true
  }
  
  tags = {
    Name        = "webtorrent-tracker-${each.key}"
    Region      = each.key
    Environment = "production"
    Service     = "tracker"
  }
  
  lifecycle {
    create_before_destroy = true
  }
}

# Elastic IPs for trackers
resource "aws_eip" "tracker" {
  for_each = var.regions
  
  provider = aws[each.value]
  
  domain   = "vpc"
  instance = aws_instance.tracker[each.key].id
  
  tags = {
    Name   = "tracker-eip-${each.key}"
    Region = each.key
  }
}

# Global Accelerator for anycast IP
resource "aws_globalaccelerator_accelerator" "tracker_anycast" {
  provider = aws.us_east
  
  name            = "p2p-music-tracker"
  ip_address_type = "DUAL_STACK"
  enabled         = true
  
  attributes {
    flow_logs_enabled   = true
    flow_logs_s3_bucket = aws_s3_bucket.flow_logs.id
    flow_logs_s3_prefix = "tracker-flow-logs/"
  }
}

# Global Accelerator listener
resource "aws_globalaccelerator_listener" "tracker" {
  provider = aws.us_east
  
  accelerator_arn = aws_globalaccelerator_accelerator.tracker_anycast.id
  client_affinity = "SOURCE_IP"
  protocol        = "TCP"
  
  port_range {
    from_port = var.tracker_port
    to_port   = var.tracker_port
  }
}

# Endpoint groups for each region
resource "aws_globalaccelerator_endpoint_group" "tracker" {
  for_each = var.regions
  
  provider = aws.us_east
  
  listener_arn = aws_globalaccelerator_listener.tracker.id
  endpoint_group_region = each.key
  
  health_check_protocol          = "TCP"
  health_check_port              = var.tracker_port
  health_check_interval_seconds  = 10
  health_check_timeout_seconds   = 5
  healthy_threshold_count        = 2
  unhealthy_threshold_count      = 3
  
  traffic_dial_percentage = 100
  
  endpoint_configuration {
    endpoint_id                    = aws_instance.tracker[each.key].id
    weight                         = 100
    client_ip_preservation_enabled = true
  }
}

# S3 bucket for flow logs
resource "aws_s3_bucket" "flow_logs" {
  provider = aws.us_east
  
  bucket = "p2p-music-tracker-flow-logs"
  
  tags = {
    Name = "tracker-flow-logs"
  }
}

resource "aws_s3_bucket_versioning" "flow_logs" {
  provider = aws.us_east
  
  bucket = aws_s3_bucket.flow_logs.id
  versioning_configuration {
    status = "Enabled"
  }
}

resource "aws_s3_bucket_server_side_encryption_configuration" "flow_logs" {
  provider = aws.us_east
  
  bucket = aws_s3_bucket.flow_logs.id
  
  rule {
    apply_server_side_encryption_by_default {
      sse_algorithm = "AES256"
    }
  }
}

# CloudWatch alarms for tracker health
resource "aws_cloudwatch_metric_alarm" "tracker_health" {
  for_each = var.regions
  
  provider = aws[each.value]
  
  alarm_name          = "tracker-health-${each.key}"
  comparison_operator = "GreaterThanThreshold"
  evaluation_periods  = "2"
  metric_name         = "StatusCheckFailed"
  namespace           = "AWS/EC2"
  period              = "60"
  statistic           = "Average"
  threshold           = "0"
  alarm_description   = "This metric monitors tracker health"
  
  dimensions = {
    InstanceId = aws_instance.tracker[each.key].id
  }
  
  alarm_actions = [aws_sns_topic.alerts.arn]
}

# SNS topic for alerts
resource "aws_sns_topic" "alerts" {
  provider = aws.us_east
  
  name = "p2p-music-alerts"
}

# Outputs
output "tracker_endpoints" {
  description = "Tracker endpoints by region"
  value = {
    for region, instance in aws_instance.tracker : region => {
      public_ip  = aws_eip.tracker[region].public_ip
      public_dns = instance.public_dns
    }
  }
}

output "anycast_ip" {
  description = "Global Accelerator anycast IP"
  value       = aws_globalaccelerator_accelerator.tracker_anycast.ip_sets
}

output "tracker_security_groups" {
  description = "Security group IDs"
  value = {
    for region, sg in aws_security_group.tracker : region => sg.id
  }
}
