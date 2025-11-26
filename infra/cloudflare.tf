# DNS records for Vercel
# Note: Domain must be registered and added to Cloudflare first (manual step)

# A record for apex domain
resource "cloudflare_record" "apex" {
  zone_id = var.cloudflare_zone_id
  name    = "@"
  content = "76.76.21.21"
  type    = "A"
  ttl     = 1
  proxied = false # Must be false for Vercel
}

# CNAME for www subdomain
resource "cloudflare_record" "www" {
  zone_id = var.cloudflare_zone_id
  name    = "www"
  content = "cname.vercel-dns.com"
  type    = "CNAME"
  ttl     = 1
  proxied = false # Must be false for Vercel
}
