# Stripe resources for nat20.day billing
# These create the product, price, webhook, and billing portal configuration

# =============================================================================
# Product & Price
# =============================================================================

resource "stripe_product" "party_subscription" {
  name        = "nat20.day Party"
  description = "Annual subscription for a nat20.day party. Includes unlimited members, real-time sync, API access, and MCP integration."
  active      = true

  # Metadata for reference
  metadata = {
    app = "nat20.day"
  }
}

resource "stripe_price" "party_annual" {
  product     = stripe_product.party_subscription.id
  currency    = "usd"
  unit_amount = 1000 # $10.00 in cents

  recurring {
    interval       = "year"
    interval_count = 1
  }

  # Metadata for reference
  metadata = {
    app  = "nat20.day"
    type = "party_subscription"
  }
}

# =============================================================================
# Webhook Endpoint
# =============================================================================

resource "stripe_webhook_endpoint" "main" {
  url = "https://${var.domain}/api/stripe-webhook"

  # Events we care about for subscription lifecycle
  enabled_events = [
    "checkout.session.completed",
    "customer.subscription.updated",
    "customer.subscription.deleted",
    "invoice.payment_failed",
    "invoice.payment_succeeded",
  ]

  description = "nat20.day subscription webhook"

  metadata = {
    app = "nat20.day"
  }
}

# =============================================================================
# Customer Portal Configuration
# =============================================================================

resource "stripe_portal_configuration" "main" {
  business_profile {
    headline = "nat20.day - Manage your subscription"
  }

  features {
    # Allow customers to update their payment method
    payment_method_update {
      enabled = true
    }

    # Allow customers to cancel their subscription
    subscription_cancel {
      enabled = true
      mode    = "at_period_end" # Cancel at end of billing period, not immediately
    }

    # Allow customers to view their invoices
    invoice_history {
      enabled = true
    }
  }

  # Set as the default portal configuration
  default_return_url = "https://${var.domain}/app/admin"
}

# =============================================================================
# Outputs
# =============================================================================

output "stripe_price_id" {
  description = "Stripe Price ID for the annual party subscription"
  value       = stripe_price.party_annual.id
}

output "stripe_webhook_secret" {
  description = "Stripe webhook signing secret"
  value       = stripe_webhook_endpoint.main.secret
  sensitive   = true
}

output "stripe_product_id" {
  description = "Stripe Product ID"
  value       = stripe_product.party_subscription.id
}
