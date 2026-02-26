import path from "path";
import fs from "fs";

const UPLOAD_DIR = path.join(process.cwd(), "uploads");

export function ensureUploadDir(): string {
  if (!fs.existsSync(UPLOAD_DIR)) {
    fs.mkdirSync(UPLOAD_DIR, { recursive: true });
  }
  return UPLOAD_DIR;
}

export function getUploadPath(filename: string): string {
  return path.join(ensureUploadDir(), filename);
}

export function readUploadStream(filename: string): fs.ReadStream | null {
  const full = getUploadPath(filename);
  if (!fs.existsSync(full)) return null;
  return fs.createReadStream(full);
}

export function deleteUploadFile(filename: string): boolean {
  const full = getUploadPath(filename);
  if (!fs.existsSync(full)) return false;
  fs.unlinkSync(full);
  return true;
}
