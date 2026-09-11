#!/usr/bin/env node
/**
 * Back-fill stripe_customer_id for existing users
 * This retrieves customer IDs from Stripe and saves them to the database
 *
 * IMPORTANT: Run this AFTER the migration is applied to the database
 *
 * Usage:
 *   node scripts/backfill-stripe-customer-ids.js
 */

const Stripe = require('stripe');
const { createClient } = require('@supabase/supabase-js');

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY);
const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

async function backfillCustomerIds() {
  console.log('🔄 Starting stripe_customer_id back-fill...\n');

  try {
    // Get all customers from Stripe that have userId metadata
    console.log('📥 Fetching customers from Stripe...');
    const customers = await stripe.customers.list({
      limit: 100,
    });

    let updated = 0;
    let skipped = 0;
    let errors = 0;

    for (const customer of customers.data) {
      const userId = customer.metadata?.userId;

      if (!userId) {
        console.log(`⏭️  Customer ${customer.id} has no userId metadata, skipping`);
        skipped++;
        continue;
      }

      // Check if this user already has the customer ID saved
      const { data: profile, error: readError } = await supabase
        .from('profiles')
        .select('stripe_customer_id')
        .eq('id', userId)
        .single();

      if (readError) {
        console.error(`❌ Failed to read profile ${userId}: ${readError.message}`);
        errors++;
        continue;
      }

      if (profile?.stripe_customer_id === customer.id) {
        console.log(`✓  User ${userId} already has correct customer ID`);
        skipped++;
        continue;
      }

      // Update the profile with the customer ID
      const { error: updateError } = await supabase
        .from('profiles')
        .update({
          stripe_customer_id: customer.id,
          subscription_status: customer.subscriptions?.data?.length > 0 ? 'active' : 'none',
        })
        .eq('id', userId);

      if (updateError) {
        console.error(`❌ Failed to update user ${userId}: ${updateError.message}`);
        errors++;
      } else {
        console.log(`✅ Updated user ${userId} with customer ID ${customer.id}`);
        updated++;
      }
    }

    console.log('\n📊 Back-fill Summary:');
    console.log(`   ✅ Updated: ${updated}`);
    console.log(`   ⏭️  Skipped: ${skipped}`);
    console.log(`   ❌ Errors: ${errors}`);
    console.log('\n✨ Back-fill complete!\n');

  } catch (err) {
    console.error('❌ Fatal error:', err.message);
    process.exit(1);
  }
}

backfillCustomerIds();
