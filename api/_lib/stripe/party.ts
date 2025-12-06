/**
 * Party Creation from Stripe Subscription
 *
 * Shared logic for creating a party with subscription after payment.
 * Used by both checkout.session.completed and invoice.paid handlers.
 */

import Stripe from "stripe"
import { getServiceClient } from "../supabase.js"
import { getCustomerId } from "./schemas.js"

export interface CreatePartyParams {
  partyName: string
  gameType: string
  userId: string
  subscription: Stripe.Subscription
}

export interface CreatePartyResult {
  partyId: string
}

/**
 * Create a party with admin, member, and subscription records.
 *
 * This consolidates the 5-step flow:
 * 1. Create party
 * 2. Add creator as admin
 * 3. Get user details
 * 4. Add creator as party member
 * 5. Create subscription record
 *
 * Includes rollback on failure for steps 1-4.
 */
export async function createPartyWithSubscription(
  params: CreatePartyParams
): Promise<CreatePartyResult> {
  const { partyName, gameType, userId, subscription } = params
  const supabase = getServiceClient()

  // Get current period from first subscription item (new Stripe API structure)
  const firstItem = subscription.items.data[0]
  const currentPeriodStart = firstItem?.current_period_start ?? subscription.created
  const currentPeriodEnd = firstItem?.current_period_end ?? (subscription.created + 365 * 24 * 60 * 60)

  // 1. Create the party
  const { data: party, error: partyError } = await supabase
    .from("parties")
    .insert({
      name: partyName,
      game_type: gameType,
    })
    .select()
    .single()

  if (partyError || !party) {
    console.error("Failed to create party:", partyError)
    throw new Error(`Failed to create party: ${partyError?.message}`)
  }

  console.log(`Created party ${party.id}`)

  // 2. Add creator as admin
  const { error: adminError } = await supabase
    .from("party_admins")
    .insert({
      party_id: party.id,
      profile_id: userId,
    })

  if (adminError) {
    console.error("Failed to add admin:", adminError)
    // Rollback: delete party
    await supabase.from("parties").delete().eq("id", party.id)
    throw new Error(`Failed to add admin: ${adminError.message}`)
  }

  // 3. Get user details for party member record
  const { data: authUser } = await supabase.auth.admin.getUserById(userId)
  const userName = authUser.user?.user_metadata?.full_name || authUser.user?.email || "Unknown"
  const userEmail = authUser.user?.email

  // 4. Add creator as party member
  const { error: memberError } = await supabase
    .from("party_members")
    .insert({
      party_id: party.id,
      name: userName,
      email: userEmail,
      profile_id: userId,
    })

  if (memberError) {
    console.error("Failed to add member:", memberError)
    // Rollback: delete admin and party
    await supabase.from("party_admins").delete().eq("party_id", party.id)
    await supabase.from("parties").delete().eq("id", party.id)
    throw new Error(`Failed to add member: ${memberError.message}`)
  }

  // 5. Create subscription record
  const { error: subError } = await supabase
    .from("subscriptions")
    .insert({
      party_id: party.id,
      stripe_subscription_id: subscription.id,
      stripe_customer_id: getCustomerId(subscription.customer),
      status: subscription.status === "active" ? "active" : "past_due",
      current_period_start: new Date(currentPeriodStart * 1000).toISOString(),
      current_period_end: new Date(currentPeriodEnd * 1000).toISOString(),
      cancel_at_period_end: subscription.cancel_at_period_end,
    })

  if (subError) {
    console.error("Failed to create subscription:", subError)
    // Note: Don't clean up party here - they paid, so keep the party even if sub record fails
    // We can reconcile manually
    throw new Error(`Failed to create subscription record: ${subError.message}`)
  }

  console.log(`Successfully created party ${party.id} with subscription`)

  return { partyId: party.id }
}
