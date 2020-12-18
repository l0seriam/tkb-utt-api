const account = require('./account');
const { username, password } = require('./account');
const fs = require('fs');

const tough = require('tough-cookie');

const { init, login, parseSelector, parseInitialFormData, getTkbDkh, parseTkbDkh, getStudentMark, generateTimeline } = require('./utt');
(async () => {
    try {
        await login(username, password);
        // const data = await getTkbDkh();

        // const data = fs.readFileSync('thoikhoabieu.json', 'utf8');
        // console.log(JSON.stringify(generateTimeline(JSON.parse(data))));
        // fs.writeFileSync('thoikhoabieu.json', JSON.stringify(parseTkbDkh(data.data)));
        // const data = await getStudentMark();
        // fs.writeFileSync('bangdiem.json', JSON.stringify(data));
        // console.log(data);

    } catch (error) {
        console.log(error);
    }
})()