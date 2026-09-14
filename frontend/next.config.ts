import type { NextConfig } from "next";
import { dirname } from "node:path";
import { fileURLToPath } from "node:url";

const projectRoot = dirname(fileURLToPath(import.meta.url));

const nextConfig: NextConfig = {
  outputFileTracingRoot: projectRoot,
  transpilePackages: ['@deck.gl/react', '@deck.gl/core', '@deck.gl/layers', '@deck.gl/aggregation-layers'],
};

export default nextConfig;
