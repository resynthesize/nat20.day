# Vercel Project
resource "vercel_project" "main" {
  name      = var.project_name
  framework = "vite"

  git_repository = {
    type = "github"
    repo = var.github_repo
  }

  build_command    = "npm run build"
  output_directory = "dist"
  install_command  = "npm install"
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
}

# Environment variables
resource "vercel_project_environment_variable" "supabase_url" {
  project_id = vercel_project.main.id
  key        = "VITE_SUPABASE_URL"
  value      = "https://${supabase_project.main.id}.supabase.co"
  target     = ["production", "preview", "development"]
}

resource "vercel_project_environment_variable" "supabase_anon_key" {
  project_id = vercel_project.main.id
  key        = "VITE_SUPABASE_ANON_KEY"
  value      = supabase_project.main.anon_key
  target     = ["production", "preview", "development"]
}

resource "vercel_project_environment_variable" "supabase_service_role_key" {
  project_id = vercel_project.main.id
  key        = "SUPABASE_SERVICE_ROLE_KEY"
  value      = supabase_project.main.service_role_key
  target     = ["production", "preview"]
}
