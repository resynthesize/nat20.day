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
  default     = "gather-party"
}

variable "domain" {
  description = "Domain name"
  type        = string
  default     = "gather.party"
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
