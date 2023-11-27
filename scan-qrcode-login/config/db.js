// db.js 模块

const { MongoClient } = require('mongodb');
const url = 'mongodb://localhost:27017';
const dbName = 'scan-qrcode';

let client = null;

async function connect() {
  try {
    if (!client) {
      client = new MongoClient(url, {
        useNewUrlParser: true,
        useUnifiedTopology: true,
        // 其他连接选项...
      });
      await client.connect();
      console.log('Connected successfully to MongoDB server');
    }

    return client.db(dbName);
  } catch (err) {
    console.error(err);
    process.exit(1);
  }
}

module.exports = { connect };
