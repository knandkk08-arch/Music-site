import "jsr:@supabase/functions-js/edge-runtime.d.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization, X-Client-Info, Apikey",
};

interface SearchRequest {
  query: string;
}

interface VideoResult {
  id: string;
  title: string;
  duration: number;
  views: number;
  thumbnail: string;
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response(null, {
      status: 200,
      headers: corsHeaders,
    });
  }

  try {
    if (req.method !== "POST") {
      return new Response(
        JSON.stringify({ error: "Method not allowed" }),
        {
          status: 405,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }

    const { query }: SearchRequest = await req.json();

    if (!query || query.trim().length === 0) {
      return new Response(
        JSON.stringify({ error: "Query is required" }),
        {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }

    const searchQuery = `ytsearch6:${query}`;
    const ytDlpCmd = new Deno.Command("yt-dlp", {
      args: [
        "-j",
        "--flat-playlist",
        "--skip-download",
        "--no-warnings",
        searchQuery,
      ],
      stdout: "piped",
      stderr: "piped",
    });

    const process = ytDlpCmd.spawn();
    const output = await process.output();

    if (!output.success) {
      return new Response(
        JSON.stringify({ error: "Search failed" }),
        {
          status: 500,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }

    const decoder = new TextDecoder();
    const outputText = decoder.decode(output.stdout);
    const data = JSON.parse(outputText);

    const results: VideoResult[] = (data.entries || []).slice(0, 6).map((entry: any) => ({
      id: entry.id,
      title: entry.title || "Unknown",
      duration: entry.duration || 0,
      views: entry.view_count || 0,
      thumbnail: entry.thumbnail || "",
    }));

    return new Response(
      JSON.stringify({ results }),
      {
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  } catch (error) {
    console.error("Error:", error);
    return new Response(
      JSON.stringify({ error: "Internal server error" }),
      {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  }
});
