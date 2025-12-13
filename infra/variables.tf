# Provider tokens
variable "vercel_api_token" {
  description = "Vercel API token"
  type        = string
  sensitive   = true
}

variable "cloudflare_api_token" {
  description = "Cloudflare API token"
  type        = string
  sensitive   = true
}

variable "supabase_access_token" {
  description = "Supabase access token"
  type        = string
  sensitive   = true
}

# Project configuration
variable "project_name" {
  description = "Project name"
  type        = string
  default     = "nat20-day"
}

variable "domain" {
  description = "Domain name"
  type        = string
  default     = "nat20.day"
}

variable "github_repo" {
  description = "GitHub repository (owner/repo)"
  type        = string
  default     = "resynthesize/gather-party"
}

variable "cloudflare_zone_id" {
  description = "Cloudflare zone ID for the domain"
  type        = string
}

variable "supabase_organization_id" {
  description = "Supabase organization ID"
  type        = string
}

variable "supabase_database_password" {
  description = "Password for the Supabase database"
  type        = string
  sensitive   = true
}

# Google OAuth (for Supabase Auth)
variable "google_client_id" {
  description = "Google OAuth client ID"
  type        = string
}

variable "google_client_secret" {
  description = "Google OAuth client secret"
  type        = string
  sensitive   = true
}

# Stripe (for billing)
# Note: stripe_price_id and stripe_webhook_secret are created by Terraform
# and don't need to be provided as variables
variable "stripe_secret_key" {
  description = "Stripe secret API key (sk_live_... or sk_test_...)"
  type        = string
  sensitive   = true
}

variable "stripe_publishable_key" {
  description = "Stripe publishable API key (pk_live_... or pk_test_...)"
  type        = string
}

# Google Places API (for address autocomplete)
variable "google_places_api_key" {
  description = "Google Places API key for address autocomplete"
  type        = string
}
