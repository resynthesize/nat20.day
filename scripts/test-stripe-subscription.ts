/**
 * Local test script for Stripe subscription creation
 * Run with: npx tsx scripts/test-stripe-subscription.ts
 */
/* eslint-disable @typescript-eslint/no-explicit-any */

import Stripe from "stripe"
import { readFileSync } from "fs"

// Read Stripe keys from terraform.tfvars
function readTerraformVar(name: string): string | undefined {
  try {
    const content = readFileSync("infra/terraform.tfvars", "utf-8")
    const match = content.match(new RegExp(`${name}\\s*=\\s*"([^"]+)"`))
    return match?.[1]
  } catch {
    return undefined
  }
}

const secretKey = readTerraformVar("stripe_secret_key")
const priceId = process.env.STRIPE_PRICE_ID || "price_1SZzBABiVKoimcZuo9MCAiBr"

if (!secretKey) {
  console.error("stripe_secret_key not found in infra/terraform.tfvars")
  process.exit(1)
}

// Test with SDK default API version
const stripe = new Stripe(secretKey, {
  typescript: true,
})

async function testSubscriptionCreation() {
  console.log("=== Stripe Subscription Test ===\n")
  console.log("Using Stripe SDK with default API version")
  console.log("Price ID:", priceId)
  console.log("")

  try {
    // Step 1: Create or find a test customer
    console.log("1. Creating test customer...")
    const customer = await stripe.customers.create({
      email: "test-embedded-payment@example.com",
      metadata: { test: "true" },
    })
    console.log("   Customer ID:", customer.id)

    // Step 2: Create subscription with default_incomplete
    console.log("\n2. Creating subscription with payment_behavior: 'default_incomplete'...")
    const subscription = await stripe.subscriptions.create({
      customer: customer.id,
      items: [{ price: priceId }],
      payment_behavior: "default_incomplete",
      payment_settings: {
        save_default_payment_method: "on_subscription",
      },
      metadata: {
        test: "true",
        party_name: "Test Party",
      },
      expand: ["latest_invoice", "pending_setup_intent"],
    })

    console.log("   Subscription ID:", subscription.id)
    console.log("   Subscription Status:", subscription.status)
    console.log("")

    // Step 3: Examine the subscription object
    console.log("3. Subscription properties:")
    console.log("   pending_setup_intent:", subscription.pending_setup_intent)
    console.log("   has pending_setup_intent:", "pending_setup_intent" in subscription)
    console.log("")

    // Step 4: Examine the invoice
    const invoice = subscription.latest_invoice
    console.log("4. Invoice examination:")
    if (typeof invoice === "string") {
      console.log("   Invoice is a string (not expanded):", invoice)
    } else if (invoice) {
      console.log("   Invoice ID:", invoice.id)
      console.log("   Invoice Status:", invoice.status)
      console.log("   Has payment_intent:", "payment_intent" in invoice)
      console.log("   payment_intent value:", (invoice as any).payment_intent)
      console.log("   Has payments:", "payments" in invoice)
      console.log("   payments value:", (invoice as any).payments)
      console.log("   confirmation_secret:", invoice.confirmation_secret)
      console.log("   hosted_invoice_url:", invoice.hosted_invoice_url)

      // Try all access patterns
      console.log("\n5. Client secret access patterns:")

      // Pattern 1: Direct payment_intent
      const pi1 = (invoice as any).payment_intent
      if (pi1?.client_secret) {
        console.log("   ✓ Pattern 1 (payment_intent): ", pi1.client_secret.substring(0, 30) + "...")
      } else {
        console.log("   ✗ Pattern 1 (payment_intent): not available")
      }

      // Pattern 2: payments array
      const payments = (invoice as any).payments
      if (payments?.data?.[0]?.payment?.payment_intent?.client_secret) {
        console.log("   ✓ Pattern 2 (payments array):", payments.data[0].payment.payment_intent.client_secret.substring(0, 30) + "...")
      } else {
        console.log("   ✗ Pattern 2 (payments array): not available")
      }

      // Pattern 3: confirmation_secret
      if (invoice.confirmation_secret?.client_secret) {
        console.log("   ✓ Pattern 3 (confirmation_secret):", invoice.confirmation_secret.client_secret.substring(0, 30) + "...")
      } else {
        console.log("   ✗ Pattern 3 (confirmation_secret): not available")
      }

      // Pattern 4: pending_setup_intent
      const psi = subscription.pending_setup_intent
      if (typeof psi !== "string" && psi?.client_secret) {
        console.log("   ✓ Pattern 4 (pending_setup_intent):", psi.client_secret.substring(0, 30) + "...")
      } else {
        console.log("   ✗ Pattern 4 (pending_setup_intent): not available")
      }
    } else {
      console.log("   No invoice!")
    }

    // Step 5b: Try retrieving the invoice directly with expand
    if (typeof invoice !== "string" && invoice) {
      console.log("\n5b. Retrieving invoice directly with payment_intent expand...")
      const retrievedInvoice = await stripe.invoices.retrieve(invoice.id, {
        expand: ["payment_intent"],
      })
      console.log("   Retrieved invoice payment_intent:", (retrievedInvoice as any).payment_intent)

      // Try finalizing the invoice to trigger PaymentIntent creation
      console.log("\n5c. Finalizing invoice to trigger PaymentIntent creation...")
      try {
        const finalizedInvoice = await stripe.invoices.finalizeInvoice(invoice.id, {
          expand: ["payment_intent"],
        })
        console.log("   Finalized invoice status:", finalizedInvoice.status)
        console.log("   Finalized invoice payment_intent:", (finalizedInvoice as any).payment_intent)

        if ((finalizedInvoice as any).payment_intent?.client_secret) {
          console.log("   ✓ Got client_secret after finalization!")
        }
      } catch (e: any) {
        console.log("   Error finalizing:", e.message)
      }

      // Try listing invoice payments via API
      console.log("\n5d. Fetching invoice payments via invoicePayments.list...")
      try {
        const payments = await stripe.invoicePayments.list({ invoice: invoice.id })
        console.log("   Invoice payments count:", payments.data.length)

        if (payments.data[0]?.payment?.payment_intent) {
          const piId = payments.data[0].payment.payment_intent
          console.log("   PaymentIntent ID:", piId)

          // Now retrieve the full PaymentIntent to get client_secret
          if (typeof piId === "string") {
            console.log("\n5e. Retrieving PaymentIntent to get client_secret...")
            const paymentIntent = await stripe.paymentIntents.retrieve(piId)
            console.log("   PaymentIntent status:", paymentIntent.status)
            console.log("   client_secret:", paymentIntent.client_secret?.substring(0, 40) + "...")
            console.log("\n   ✓✓✓ SUCCESS! This is the working pattern! ✓✓✓")
          }
        }
      } catch (e: any) {
        console.log("   Error:", e.message)
      }
    }

    // Clean up
    console.log("\n6. Cleaning up...")
    await stripe.subscriptions.cancel(subscription.id)
    await stripe.customers.del(customer.id)
    console.log("   ✓ Deleted test subscription and customer")

  } catch (error) {
    console.error("\nError:", error)
  }
}

testSubscriptionCreation()
