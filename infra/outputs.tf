output "vercel_project_id" {
  description = "Vercel project ID"
  value       = vercel_project.main.id
}

output "vercel_url" {
  description = "Vercel deployment URL"
  value       = "https://${var.domain}"
}

output "supabase_project_id" {
  description = "Supabase project ID"
  value       = supabase_project.main.id
}

output "supabase_url" {
  description = "Supabase API URL"
  value       = "https://${supabase_project.main.id}.supabase.co"
}

# Note: Supabase anon_key and service_role_key must be retrieved from
# the Supabase dashboard and added to Vercel env vars manually.
# Dashboard: https://supabase.com/dashboard/project/{project_id}/settings/api
