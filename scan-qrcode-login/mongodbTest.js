const mongoose = require('mongoose');

const uri = 'mongodb://localhost:27017/scan-qrcode';

mongoose.connect(uri, { useNewUrlParser: true, useUnifiedTopology: true })
  .then(() => {
    console.log('MongoDB Connected');
    mongoose.connection.close();
  })
  .catch(err => console.error('MongoDB connection error:', err));
