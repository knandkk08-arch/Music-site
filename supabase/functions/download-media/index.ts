import "jsr:@supabase/functions-js/edge-runtime.d.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization, X-Client-Info, Apikey",
};

interface DownloadRequest {
  videoId: string;
  format: "audio" | "video";
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

    const { videoId, format }: DownloadRequest = await req.json();

    if (!videoId || !format) {
      return new Response(
        JSON.stringify({ error: "videoId and format are required" }),
        {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }

    const videoUrl = `https://www.youtube.com/watch?v=${videoId}`;
    const tmpDir = "/tmp";
    const outputTemplate = `${tmpDir}/%(title)s.%(ext)s`;

    const args = ["-o", outputTemplate, "--quiet", "--no-warnings"];

    if (format === "audio") {
      args.push(
        "-f",
        "worstaudio/worst",
        "-x",
        "--audio-format",
        "mp3",
        "--audio-quality",
        "48K"
      );
    } else {
      args.push("-f", "best[ext=mp4]/best");
    }

    args.push(videoUrl);

    const ytDlpCmd = new Deno.Command("yt-dlp", {
      args,
      stdout: "piped",
      stderr: "piped",
    });

    const process = ytDlpCmd.spawn();
    const output = await process.output();

    if (!output.success) {
      const decoder = new TextDecoder();
      const errorMsg = decoder.decode(output.stderr);
      console.error("yt-dlp error:", errorMsg);
      return new Response(
        JSON.stringify({ error: "Download failed: " + errorMsg.substring(0, 100) }),
        {
          status: 500,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }

    const files = Deno.readDirSync(tmpDir);
    let targetFile: string | null = null;
    const targetExt = format === "audio" ? ".mp3" : ".mp4";

    for (const file of files) {
      if (file.isFile && file.name.endsWith(targetExt)) {
        const filePath = `${tmpDir}/${file.name}`;
        const stat = Deno.statSync(filePath);
        if (!targetFile || stat.mtime! > Deno.statSync(`${tmpDir}/${targetFile}`).mtime!) {
          targetFile = file.name;
        }
      }
    }

    if (!targetFile) {
      return new Response(
        JSON.stringify({ error: "File not found after download" }),
        {
          status: 500,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }

    const filePath = `${tmpDir}/${targetFile}`;
    const fileData = await Deno.readFile(filePath);
    const mimeType = format === "audio" ? "audio/mpeg" : "video/mp4";

    try {
      Deno.removeSync(filePath);
    } catch (_e) {
      console.error("Failed to cleanup file");
    }

    return new Response(fileData, {
      status: 200,
      headers: {
        ...corsHeaders,
        "Content-Type": mimeType,
        "Content-Disposition": `attachment; filename="${targetFile}"`,
      },
    });
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
