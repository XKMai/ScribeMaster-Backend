Setup backend before frontend  
To setup:  
Clone this to local storage/VScode  
Download postgresql and pgadmin 4, setup postgresql. Set your own password, user etc.  
Change the DATABASE_URL in the .env file to match the db url, postgresql://[user[:password]@][netloc][:port][/dbname][?param1=value1&...],   
**example:** postgres://postgres:example_password@localhost:5432/postgres

In terminal, type:   
npm install
npm run drizzle:generate 
npm run drizzle:push 
npm run start (Wait a bit, should start the backend server)

Note the url at the terminal, example: "Server listening at http://127.0.0.1:5000"  
The api endpoints exposed that are needed are /login, /register, /me

Take note of frontend url after setting up frontend, ensure CORS origin is same as frontend url. If not, copy frontend url and replace cors origin in main.ts.  
Frontend Github: https://github.com/harun-abdullah/scribemaster_frontend
