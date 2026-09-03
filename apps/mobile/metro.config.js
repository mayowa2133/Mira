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
// NOTE: do NOT set `disableHierarchicalLookup`. It stops Metro walking into
// nested node_modules, and npm workspaces legitimately nest packages that
// cannot be hoisted — expo-router ships its own expo-glass-effect, which then
// fails to resolve at runtime with "could not be found within the project".
// That flag is for pnpm-style layouts, not this one.

module.exports = config;
