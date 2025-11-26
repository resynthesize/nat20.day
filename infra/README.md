# Infrastructure (Terraform)

This directory contains Terraform configuration for provisioning:
- **Vercel**: Project, domains, environment variables
- **Cloudflare**: DNS records
- **Supabase**: Project (database + auth)

## Secrets Management

**NEVER commit secrets to git.** Here's how secrets are handled:

### Local Development
1. Copy `terraform.tfvars.example` to `terraform.tfvars`
2. Fill in your actual values
3. `terraform.tfvars` is git-ignored

### CI/CD (GitHub Actions)
Secrets are passed via environment variables:
- `TF_VAR_vercel_api_token`
- `TF_VAR_cloudflare_api_token`
- `TF_VAR_supabase_access_token`
- etc.

Set these in GitHub repo settings → Secrets and variables → Actions.

## Getting API Tokens

| Service | Where to get token |
|---------|-------------------|
| Vercel | https://vercel.com/account/tokens |
| Cloudflare | https://dash.cloudflare.com/profile/api-tokens |
| Supabase | https://supabase.com/dashboard/account/tokens |
| Google OAuth | https://console.cloud.google.com/apis/credentials |

## Usage

```bash
# First time setup
cp terraform.tfvars.example terraform.tfvars
# Edit terraform.tfvars with your values

# Initialize
terraform init

# Preview changes
terraform plan

# Apply changes
terraform apply

# Get outputs (Supabase keys, etc.)
terraform output
terraform output -raw supabase_anon_key
```

## One-Time Manual Steps

These cannot be automated via Terraform:

1. **Buy domain**: Purchase `gather.party` on Cloudflare (~$4.16)
2. **Add domain to Cloudflare**: Get the zone ID after adding
3. **Create Google OAuth credentials**: In GCP Console, create OAuth 2.0 credentials
4. **Configure Supabase Auth**: After `terraform apply`, enable Google provider in Supabase dashboard
