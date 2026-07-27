import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Only pulls in the specific icon modules a file actually imports instead
  // of touching lucide-react's whole barrel file at build time — lucide-react
  // is imported from dozens of components across this app (every studio,
  // the sidebar, every modal), so this meaningfully speeds up cold builds
  // and keeps per-route chunks from accidentally pulling in the entire
  // icon set. Safe/no-op for anything that's already tree-shaking cleanly.
  experimental: {
    optimizePackageImports: ["lucide-react"],
  },
};

export default nextConfig;
