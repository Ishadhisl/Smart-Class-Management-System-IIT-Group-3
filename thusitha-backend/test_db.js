require('dotenv').config();
const { Client } = require('pg');

async function testDatabase() {
    const client = new Client({
        user: process.env.DB_USER || 'postgres',
        host: process.env.DB_HOST || '127.0.0.1',
        database: process.env.DB_NAME || 'thusithaedu_db',
        password: process.env.DB_PASSWORD || '0909',
        port: process.env.DB_PORT || 5432
    });

    try {
        console.log(`🔌 Connecting to database '${process.env.DB_NAME || 'thusithaedu_db'}' on ${process.env.DB_HOST || '127.0.0.1'}:${process.env.DB_PORT || 5432}...`);
        await client.connect();
        const res = await client.query('SELECT NOW() as current_time, current_database() as db_name, count(*) as table_count FROM information_schema.tables WHERE table_schema=\'public\'');
        console.log('✅ Connection Successful!');
        console.log(`📊 Database: ${res.rows[0].db_name}`);
        console.log(`⏰ Time: ${res.rows[0].current_time}`);
        console.log(`📑 Total Tables: ${res.rows[0].table_count}`);
        await client.end();
    } catch (err) {
        console.error('❌ Connection Failed:', err.message);
    }
}

testDatabase();

