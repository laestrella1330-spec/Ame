import bcrypt from 'bcryptjs';
import { initDb, execute, queryOne, saveDb } from '../db/connection.js';
import { config } from '../config.js';

const username = process.argv[2] || config.adminUsername;
const password = process.argv[3] || config.adminPassword;

async function main() {
  await initDb();

  const hash = bcrypt.hashSync(password, 12);

  const existing = queryOne('SELECT * FROM admins WHERE username = ?', [username]);
  if (existing) {
    execute('UPDATE admins SET password_hash = ? WHERE username = ?', [hash, username]);
    console.log(`Admin user "${username}" password reset successfully.`);
  } else {
    execute('INSERT INTO admins (username, password_hash) VALUES (?, ?)', [username, hash]);
    console.log(`Admin user "${username}" created successfully.`);
  }

  saveDb();
  process.exit(0);
}

main().catch((err) => {
  console.error('Error:', err.message);
  process.exit(1);
});
