import { fileURLToPath } from 'url';
import { dirname, resolve } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

/** @type {import('next').NextConfig} */
const nextConfig = {
  webpack: (config) => {
    config.resolve.alias['@sqds/multisig'] = resolve(__dirname, 'node_modules/@sqds/multisig');
    return config;
  },
};

export default nextConfig;
