const dotenv = require("dotenv");
dotenv.config({ path: "./.env" });

const app = require("./app");

app.get('/', (req, res) => {
    res.status(200).send("Welcome, here!");
});

const port = process.env.PORT || 8000;

app.listen(port, async () => {
    console.log(`App is running on port ${port}`);
    
    const open = await import('open'); 
    // open.default(`http://127.0.0.1:${port}`); 
});
