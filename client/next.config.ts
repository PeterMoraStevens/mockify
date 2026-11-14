import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Produces .next/standalone for the Docker image.
  output: "standalone",
  // Seed problems are read from disk at runtime; ship them with the server.
  outputFileTracingIncludes: {
    "/**": ["./problems/**/*.json"],
  },
};

export default nextConfig;
