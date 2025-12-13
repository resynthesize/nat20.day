# Vercel Project with GitHub integration
# Pushes to main branch auto-deploy to production
resource "vercel_project" "main" {
  name      = var.project_name
  framework = "vite"

  build_command    = "npm run build"
  output_directory = "dist"
  install_command  = "npm install"

  git_repository = {
    type = "github"
    repo = "resynthesize/nat20.day"
  }
}

# Production domain
resource "vercel_project_domain" "main" {
  project_id = vercel_project.main.id
  domain     = var.domain
}

# WWW redirect
resource "vercel_project_domain" "www" {
  project_id = vercel_project.main.id
  domain     = "www.${var.domain}"

  redirect             = var.domain
  redirect_status_code = 308

  depends_on = [vercel_project_domain.main]
}

# Environment variables
resource "vercel_project_environment_variable" "supabase_url" {
  project_id = vercel_project.main.id
  key        = "VITE_SUPABASE_URL"
  value      = "https://${supabase_project.main.id}.supabase.co"
  target     = ["production", "preview", "development"]
}

# Note: VITE_SUPABASE_ANON_KEY and SUPABASE_SERVICE_ROLE_KEY must be added
# manually in Vercel dashboard after Supabase project is created.
# Get keys from: https://supabase.com/dashboard/project/{project_id}/settings/api

# Stripe environment variables (for billing)
resource "vercel_project_environment_variable" "stripe_secret_key" {
  project_id = vercel_project.main.id
  key        = "STRIPE_SECRET_KEY"
  value      = var.stripe_secret_key
  target     = ["production", "preview"]
}

resource "vercel_project_environment_variable" "stripe_webhook_secret" {
  project_id = vercel_project.main.id
  key        = "STRIPE_WEBHOOK_SECRET"
  value      = stripe_webhook_endpoint.main.secret
  target     = ["production"] # Webhook secret is environment-specific
}

resource "vercel_project_environment_variable" "stripe_price_id" {
  project_id = vercel_project.main.id
  key        = "STRIPE_PRICE_ID"
  value      = stripe_price.party_annual.id
  target     = ["production", "preview"]
}

resource "vercel_project_environment_variable" "stripe_publishable_key" {
  project_id = vercel_project.main.id
  key        = "VITE_STRIPE_PUBLISHABLE_KEY"
  value      = var.stripe_publishable_key
  target     = ["production", "preview"]
}

resource "vercel_project_environment_variable" "google_places_api_key" {
  project_id = vercel_project.main.id
  key        = "VITE_GOOGLE_PLACES_API_KEY"
  value      = var.google_places_api_key
  target     = ["production", "preview"]
}
