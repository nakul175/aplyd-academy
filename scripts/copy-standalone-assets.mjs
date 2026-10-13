// Copy static assets next to the standalone Node server (Next does not do this itself).
import { cpSync, existsSync } from 'node:fs';
cpSync('.next/static', '.next/standalone/.next/static', { recursive: true });
if (existsSync('public')) cpSync('public', '.next/standalone/public', { recursive: true });
console.log('standalone assets copied');
