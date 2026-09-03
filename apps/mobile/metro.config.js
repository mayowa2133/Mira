// Metro configuration for the Mira monorepo.
//
// Expo defaults assume a single-package project. In a workspace, Metro must
// watch the repository root and resolve hoisted modules from it, otherwise
// `@mira/ui` and `@mira/types` cannot be imported from the app.
const { getDefaultConfig } = require('expo/metro-config');
const path = require('node:path');

const projectRoot = __dirname;
const workspaceRoot = path.resolve(projectRoot, '../..');

const config = getDefaultConfig(projectRoot);

config.watchFolders = [workspaceRoot];
config.resolver.nodeModulesPaths = [
  path.resolve(projectRoot, 'node_modules'),
  path.resolve(workspaceRoot, 'node_modules'),
];
// Prefer the hoisted copy, so React is never duplicated.
config.resolver.disableHierarchicalLookup = true;

module.exports = config;
