import pkg from 'pg';
const { Client } = pkg;

const client = new Client({
  connectionString: process.env.DATABASE_URL,
});

async function test() {
  try {
    await client.connect();
    const res = await client.query('SELECT NOW()');
    console.log('✅ Connected:', res.rows);
  } catch (err) {
    console.error('❌ Error:', err);
  } finally {
    await client.end();
  }
}

test();
import pkg from 'pg';
const { Client } = pkg;

const client = new Client({
  connectionString: process.env.DATABASE_URL,
});

async function test() {
  try {
    await client.connect();
    const res = await client.query('SELECT NOW()');
    console.log('✅ Connected:', res.rows);
  } catch (err) {
    console.error('❌ Error:', err);
  } finally {
    await client.end();
  }
}

test();
