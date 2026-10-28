import { createClient } from '@supabase/supabase-js';
import { createSupabaseRouteClient } from '../../../lib/supabase-server';

export const dynamic = 'force-dynamic';

export async function POST(request) {
  try {
    const supabase = createSupabaseRouteClient();
    const { data: { user } } = await supabase.auth.getUser();
    const body = await request.json();

    const {
      eventType,
      eventName: eventNameCamel,
      event_name, // lib/track.js (every website funnel event) sends snake_case
      eventCategory,
      pageUrl,
      referrer,
      properties = {},
      session_id,
      url, // legacy
    } = body;

    const userId = user?.id ?? null;
    const pageUrlToUse = pageUrl || url;
    let result = null;
    const eventName = eventNameCamel || event_name;

    // Route to appropriate tracking table based on event type
    if (eventType === 'click') {
      result = await supabase.from('click_events').insert({
        user_id: userId,
        page_path: pageUrlToUse,
        element_type: properties.elementType,
        element_id: properties.elementId,
        element_class: properties.elementClass,
        element_selector: properties.elementSelector,
        button_text: properties.buttonText,
        link_href: properties.linkHref,
        section_name: properties.sectionName,
        cta_name: properties.ctaName,
        click_x: properties.clickX,
        click_y: properties.clickY,
        viewport_width: properties.viewportWidth,
        viewport_height: properties.viewportHeight,
        device_type: properties.deviceType,
        session_id: properties.sessionId || session_id,
        properties,
      });
    } else if (eventType === 'engagement') {
      result = await supabase.from('engagement_events').insert({
        user_id: userId,
        page_path: pageUrlToUse,
        page_title: properties.pageTitle,
        session_id: properties.sessionId || session_id,
        event_type: properties.engagementType,
        scroll_depth_percent: properties.scrollDepthPercent,
        time_on_page_seconds: properties.timeOnPageSeconds,
        element_selector: properties.elementSelector,
        referrer,
        device_type: properties.deviceType,
        browser: properties.browser,
        os: properties.os,
      });
    } else if (eventType === 'error') {
      result = await supabase.from('error_events').insert({
        user_id: userId,
        error_type: properties.errorType,
        error_message: properties.errorMessage,
        error_stack: properties.errorStack,
        page_url: pageUrlToUse,
        endpoint: properties.endpoint,
        http_status_code: properties.httpStatusCode,
        severity: properties.severity || 'medium',
        source: properties.source || 'client',
        properties,
      });
    } else if (eventType === 'api_call') {
      result = await supabase.from('api_calls').insert({
        user_id: userId,
        endpoint: properties.endpoint,
        method: properties.method,
        status_code: properties.statusCode,
        response_time_ms: properties.responseTimeMs,
        error_message: properties.errorMessage,
        request_body: properties.requestBody,
        response_summary: properties.responseSummary,
      });
    } else if (eventType === 'csv_upload') {
      result = await supabase.from('csv_upload_events').insert({
        user_id: userId,
        upload_session_id: properties.uploadSessionId,
        filename: properties.filename,
        platform: properties.platform,
        status: properties.status,
        file_size_bytes: properties.fileSizeBytes,
        row_count: properties.rowCount,
        rows_validated: properties.rowsValidated,
        rows_imported: properties.rowsImported,
        rows_rejected: properties.rowsRejected,
        error_code: properties.errorCode,
        error_message: properties.errorMessage,
        validation_errors: properties.validationErrors,
        import_duration_ms: properties.importDurationMs,
      });
    } else if (eventType === 'checkout') {
      result = await supabase.from('checkout_events').insert({
        user_id: userId,
        session_id: properties.sessionId,
        status: properties.status,
        plan_type: properties.planType,
        plan_price: properties.planPrice,
        billing_cycle: properties.billingCycle,
        stripe_session_id: properties.stripeSessionId,
        stripe_intent_id: properties.stripeIntentId,
        error_code: properties.errorCode,
        error_message: properties.errorMessage,
        failure_reason: properties.failureReason,
        properties,
      });
    } else if (eventType === 'free_trial') {
      result = await supabase.from('free_trial_events').insert({
        user_id: userId,
        event_type: properties.eventType,
        trial_days_offered: properties.trialDaysOffered,
        trial_starts_at: properties.trialStartsAt,
        trial_expires_at: properties.trialExpiresAt,
        converted_plan: properties.convertedPlan,
        converted_at: properties.convertedAt,
        properties,
      });
    } else if (eventType === 'tip') {
      result = await supabase.from('tip_analytics').insert({
        user_id: userId,
        tipper_username: properties.tipperUsername,
        amount_tokens: properties.amountTokens,
        amount_usd: properties.amountUsd,
        platform: properties.platform,
        tip_type: properties.tipType,
        is_live: properties.isLive,
        live_session_id: properties.liveSessionId,
        device_type: properties.deviceType,
        country: properties.country,
        recorded_at: properties.recordedAt,
      });
    } else if (eventType === 'session') {
      result = await supabase.from('user_sessions').insert({
        user_id: userId,
        session_id: properties.sessionId || session_id,
        device_type: properties.deviceType,
        browser: properties.browser,
        os: properties.os,
        country: properties.country,
        referrer,
        utm_source: properties.utmSource,
        utm_medium: properties.utmMedium,
        utm_campaign: properties.utmCampaign,
        utm_content: properties.utmContent,
        utm_term: properties.utmTerm,
      });
    } else {
      // Legacy: fall back to analytics_events
      // analytics_events columns: user_id, event_name, properties, session_id,
      // url. It has no page_url/event_category/referrer columns — writing them
      // made every insert that carried a URL (all of lib/track.js's events)
      // fail, silently, from 2026-09-18 on.
      result = await supabase.from('analytics_events').insert({
        user_id: userId,
        event_name: eventName || 'unknown',
        properties: {
          ...properties,
          ...(eventCategory ? { event_category: eventCategory } : {}),
          ...(referrer ? { referrer } : {}),
        },
        session_id: session_id || properties.sessionId || null,
        url: pageUrlToUse || null,
      });
    }

    if (result?.error) {
      console.error('[/api/track] insert failed:', eventType || eventName, result.error.message);
      return Response.json({ success: false, error: 'insert_failed' }, { status: 200 });
    }

    return Response.json({ success: true, eventType });
  } catch (err) {
    console.error('[/api/track] Error:', err.message);
    // Don't fail the response — tracking failures shouldn't break the app
    return Response.json({ success: false, error: err.message }, { status: 200 });
  }
}
