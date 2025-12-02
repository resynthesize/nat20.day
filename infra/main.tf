terraform {
  required_version = ">= 1.0"

  required_providers {
    vercel = {
      source  = "vercel/vercel"
      version = "~> 2.0"
    }
    cloudflare = {
      source  = "cloudflare/cloudflare"
      version = "~> 4.0"
    }
    supabase = {
      source  = "supabase/supabase"
      version = "~> 1.0"
    }
    stripe = {
      source  = "lukasaron/stripe"
      version = "~> 3.4"
    }
  }

  # Uncomment for remote state (recommended for production)
  # backend "s3" {
  #   bucket = "nat20-day-tfstate"
  #   key    = "terraform.tfstate"
  #   region = "us-east-1"
  # }
}

provider "vercel" {
  api_token = var.vercel_api_token
}

provider "cloudflare" {
  api_token = var.cloudflare_api_token
}

provider "supabase" {
  access_token = var.supabase_access_token
}

provider "stripe" {
  api_key = var.stripe_secret_key
}
