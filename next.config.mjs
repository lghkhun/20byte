/** @type {import('next').NextConfig} */
const nextConfig = {
  experimental: {
    serverComponentsExternalPackages: ["baileys", "ws", "bufferutil", "utf-8-validate"]
  },
  webpack: (config, { isServer }) => {
    if (isServer) {
      const externalPackages = {
        baileys: "commonjs baileys",
        ws: "commonjs ws",
        bufferutil: "commonjs bufferutil",
        "utf-8-validate": "commonjs utf-8-validate"
      };

      config.externals = config.externals ?? [];
      config.externals.push(externalPackages);
    }

    return config;
  }
};

export default nextConfig;
