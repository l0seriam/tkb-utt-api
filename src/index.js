const express = require('express');
const fs = require('fs');
const app = express();
const port = process.env.PORT || 3000;
const { login, getTkbDkh, parseTkbDkh } = require('./utt');
const tough = require('tough-cookie');
app.use(express.json());

app.get('/', (req, res) => {
    res.send({ message: 'Small app by ung0v' });
});

app.post('/getTkb', async (req, res) => {
    const username = req.body.username;
    const password = req.body.password;
    try {
        await login(username, password);
        const data = await getTkbDkh();
        const result = parseTkbDkh(data.data);
        res.send(result);
    } catch (error) {
        res.status(400).send(error);
    }
})
app.get('/utt', (req, res) => {
    const data = fs.readFileSync('thoikhoabieu.json', 'utf8');
    res.send(data);
})
app.listen(port, () => {
    console.log(`App listening at PORT ${port}`);
})