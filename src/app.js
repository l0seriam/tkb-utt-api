const account = require('./account');
const { username, password } = require('./account');
const fs = require('fs');

const tough = require('tough-cookie');

const { init, login, parseSelector, parseInitialFormData, getTkbDkh, parseTkbDkh, getStudentMark } = require('./utt');
(async () => {
    try {
        await login(username, password);

        const data = await getTkbDkh();
        console.log(parseTkbDkh(data.data));
        // fs.writeFileSync('thoikhoabieu.json', JSON.stringify(parseTkbDkh(data.data)));
        // const data = await getStudentMark();
        // console.log(data);

    } catch (error) {
        console.log(error);
    }
})()