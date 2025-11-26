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

output "supabase_anon_key" {
  description = "Supabase anonymous key"
  value       = supabase_project.main.anon_key
  sensitive   = true
}

output "supabase_service_role_key" {
  description = "Supabase service role key"
  value       = supabase_project.main.service_role_key
  sensitive   = true
}
