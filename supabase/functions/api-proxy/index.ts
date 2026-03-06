qimport { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const API_BASE_URL = 'http://ggenvsolutions.com/get_sensor_data.php';

serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const url = new URL(req.url);
    const action = url.searchParams.get('action') || 'get_locations';
    const deviceId = url.searchParams.get('device_id');

    let apiUrl = `${API_BASE_URL}?action=${action}`;
    if (deviceId) {
      apiUrl += `&device_id=${deviceId}`;
    }

    console.log(`Proxying request to: ${apiUrl}`);

    const response = await fetch(apiUrl);
    const rawText = await response.text();
    
    console.log(`Raw response (first 200 chars):`, rawText.substring(0, 200));

    // Try to extract JSON from the response (handle PHP comments/whitespace)
    let data;
    try {
      // First, try to find a JSON object in the response
      const jsonMatch = rawText.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        data = JSON.parse(jsonMatch[0]);
      } else {
        // Try parsing directly if no match
        data = JSON.parse(rawText);
      }
    } catch (parseError) {
      console.error('JSON parse error:', parseError);
      console.error('Raw response:', rawText);
      throw new Error(`Invalid JSON response from API: ${rawText.substring(0, 100)}`);
    }

    console.log(`Parsed response:`, data);

    return new Response(JSON.stringify(data), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  } catch (error) {
    console.error('Proxy error:', error);
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    return new Response(
      JSON.stringify({ success: false, message: errorMessage }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
