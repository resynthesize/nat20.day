# Supabase Project
resource "supabase_project" "main" {
  organization_id   = var.supabase_organization_id
  name              = var.project_name
  database_password = var.supabase_database_password
  region            = "us-east-1"

  lifecycle {
    ignore_changes = [database_password]
  }
}

# Note: Google OAuth provider configuration may need to be done via Supabase dashboard
# or CLI as the Terraform provider support varies. The settings below document the intent.
#
# After terraform apply, configure Google OAuth in Supabase dashboard:
# 1. Go to Authentication > Providers > Google
# 2. Enable Google provider
# 3. Add Client ID: var.google_client_id
# 4. Add Client Secret: var.google_client_secret
# 5. Add redirect URL to Google Console: https://<project-id>.supabase.co/auth/v1/callback
