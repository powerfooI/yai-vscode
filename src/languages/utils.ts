import * as fs from 'fs'

// Judge whether a path exists
export function pathExists(p: string): boolean {
  try {
    fs.accessSync(p);
  } catch (err) {
    return false;
  }
  return true;
}
