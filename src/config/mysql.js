import mysql from "mysql";
import dotenv from "dotenv";

// Load environment variables
dotenv.config();

// Create MySQL connection
const mysqlConnection = mysql.createConnection({
  host: process.env.DB_HOST,
  user: process.env.DB_USER,
  password: process.env.DB_PASSWORD,
  database: process.env.DB_NAME,
  port: process.env.DB_PORT || 3306,
});

// Connect to MySQL
mysqlConnection.connect((err) => {
  if (err) {
    console.error("MySQL connection failed:", err.message);
    process.exit(1); // Exit if DB connection fails
  } else {
    console.log(`Connected to MySQL @ ${process.env.DB_HOST}`);
  }
});

export default mysqlConnection;
