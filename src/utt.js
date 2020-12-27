const cheerio = require('cheerio');
const md5 = require('md5');
var request = require('request-promise');
var moment = require('moment-timezone');
moment.tz.setDefault('Asia/Ho_Chi_Minh');
moment.locale('vi-VN');
const period_board = require('./periodBoard.js');
const API = 'http://qldt.utt.edu.vn/CMCSoft.IU.Web.Info';


request = request.defaults({
  transform(body) {
    let $ = cheerio.load(body);
    err_text = $('#lblErrorInfo').text();
    if (err_text && err_text.trim()) throw err_text;

    return $;
  },
  headers: {
    'Connection': 'keep-alive',
    'Pragma': 'no-cache',
    'Cache-Control': 'no-cache',
    'Upgrade-Insecure-Requests': '1',
    'Origin': 'http://qldt.utt.edu.vn',
    'Content-Type': 'application/x-www-form-urlencoded',
    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/86.0.4240.193 Safari/537.36',
    'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,image/apng,*/*;q=0.8,application/signed-exchange;v=b3;q=0.9',
    'Referer': 'http://qldt.utt.edu.vn/CMCSoft.IU.Web.Info/Login.aspx?url=http://qldt.utt.edu.vn/CMCSoft.IU.Web.Info/Home.aspx',
    'Accept-Language': 'vi-VN,vi;q=0.9',
  },
  jar: true
  // agentOptions: {
  //   secureProtocol: 'TLSv1_method'
  // }
  // proxy: 'http://localhost:8080',
  // strictSSL: false 
});
init = async (options = {}) => {
  let jar = request.jar();

  await request(API + '/', {
    ...options,
    jar
  });

  return jar;
}

parseSelector = ($) => {
  let data = {};
  let form = $('form');
  let select = form.find('select');

  select.each((i, elem) => {
    let options = $(elem).find($('option'));

    let cooked_options = options.toArray().map(option => {
      option = $(option);

      return {
        value: option.attr('value'),
        text: option.text(),
        selected: option.attr('selected') ? true : false
      };
    });

    data[$(elem).attr('name')] = cooked_options;
  });

  return data;
}
parseInitialFormData = ($) => {
  let form = $('form');
  let select = form.find('select');
  let input = form.find('input');

  let data = {};

  input.each((i, elem) => {
    data[$(elem).attr('name')] = $(elem).attr('value');
  });

  select.each((i, elem) => {
    data[$(elem).attr('name')] = $(elem).find($('[selected="selected"]')).attr('value');
  });

  return data;
}

login = async (username, password, options = {}) => {

  if (!options.shouldNotEncrypt) {
    password = md5(password);
    delete options.shouldNotEncrypt;
  }
  let endpoint = `${API}/Login.aspx`;

  let res = await request(endpoint, options);

  let data = parseInitialFormData(res);
  let form = {
    ...data,
    txtUserName: username,
    txtPassword: password,
  };
  return await request.post(endpoint, { form: form, simple: false, ...options });
}
getTkbDkh = async (options = {}) => {
  let endpoint = `${API}/StudyRegister/StudyRegister.aspx`;

  let $ = await request.get(endpoint, options);

  if (!options) options = parseSelector($);

  initialFormData = parseInitialFormData($);


  delete initialFormData.btnView;

  let tkb = $('#Table4').find('.tableborder');

  tkb.find('br').replaceWith('\n');

  let rows = tkb.find('tr');

  let res = rows.toArray().map(elem => {
    cols = $(elem).find('td');

    return cols.toArray().map(elem1 => {
      return $(elem1).text().trim();
    });
  });

  return { data: res, options: parseSelector($) };
}

parseTkbDkh = (data, options = {}) => {
  data = data.slice(1, data.length - 1);

  data = data.map(rows => {
    rows = rows.map(cell => {
      let cells = cell.split('\n');

      cells = cells.map(item => item.trim());

      if (cells.length === 1) cells = cells[0];

      return cells;
    });

    let [stt, huy, lop_hoc_phan, hoc_phan, thoi_gian, dia_diem, giang_vien, si_so, da_dk, so_tc, hoc_phi, ghi_chu] = rows;

    return { lop_hoc_phan, hoc_phan, thoi_gian, dia_diem, giang_vien, si_so, da_dk, so_tc, hoc_phi, ghi_chu }
  });

  const date_range_pattern = /(.+?) đến (.+?):( \((.{1,}?)\))?/;
  const time_pattern = /Thứ ([0-9]) tiết ([0-9,]+?) \((.+?)\)/g;

  data = data.map(subject => {
    let ranges = [];
    let khoang_thoi_gian = subject.thoi_gian
      .map(tg => tg.trim())
      .join('|')
      .split('Từ ')
      .filter(a => a)

    let matches = date_range_pattern.exec(khoang_thoi_gian[0]);

    if (matches) {
      let phases = [];

      let [orig, start, end, g3, phase] = matches;
      var match1;

      do {
        match1 = time_pattern.exec(khoang_thoi_gian);

        if (match1) {
          let [orig1, day, periods, type] = match1;

          periods = periods.split(',');

          phases.push({
            day,
            periods,
            type
          });
        };
      } while (match1);

      ranges.push({
        start,
        end,
        phases,
        phase
      });
    }

    subject.thoi_gian = subject.thoi_gian.join('\n');
    return { ...subject, ranges };
  });

  return data;
}
parseDate = (date) => {
  return moment(date, "DD/MM/YYYY");
}

generateTimestamps = (start, end, weekday) => {
  let res = [];
  start.weekday(weekday);

  while (start.isSameOrBefore(end)) {
    if (start.isSameOrBefore(end)) {
      res.push(start.clone());
    }
    start.add(1, 'week');
  }

  return res;
}

generateClasses = (time_arr, start_period, end_period) => {
  return time_arr.map(timestamp => {
    return {
      start: timestamp.clone().hour(period_board[start_period].start.hour).minute(period_board[start_period].start.minute),
      end: timestamp.clone().hour(period_board[end_period].end.hour).minute(period_board[end_period].end.minute),
    };
  });
}

generateTimeline = (schedule) => {
  let timeline = [];

  for (subject of schedule) {
    for (range of subject.ranges) {
      for (phase of range.phases) {
        let timestamps = generateClasses(generateTimestamps(parseDate(range.start), parseDate(range.end), parseInt(phase.day) - 2), parseInt(phase.periods[0]), parseInt(phase.periods[phase.periods.length - 1]));

        for (timestamp of timestamps) {
          let data = {
            timestamp,
            ...subject,
            phase: range.phase,
            type: phase.type
          };

          delete data.ranges;

          timeline.push(data);
        };
      };
    };
  };

  timeline.sort((a, b) => a.timestamp.start - b.timestamp.start);
  return timeline;
}

groupTimelineByDay = (timeline) => {
  let days = {};

  timeline.map(subject => {
    let timestamp = subject.timestamp.start.clone().startOf('day');

    if (!days[timestamp]) days[timestamp] = {
      day: timestamp,
      subjects: []
    }

    days[timestamp].subjects.push(subject);
  });

  let result = Object.values(days)

  result = result.map(day => {
    if (day.day.clone().isSame(moment(), 'day')) {
      day.today = true;
    }

    return day;
  });

  return result;
}

getStudentMark = async (options = {}) => {
  let endpoint = `${API}/StudentMark.aspx`;

  let $ = await request.get(endpoint, options);

  if (!options) options = parseSelector($);

  initialFormData = parseInitialFormData($);


  delete initialFormData.btnView;

  let tkb = $('#tblMarkDetail').find('.tableborder');

  tkb.find('br').replaceWith('\n');

  let rows = tkb.find('tr');

  let res = rows.toArray().map(elem => {
    cols = $(elem).find('td');

    return cols.toArray().map(elem1 => {
      return $(elem1).text().trim();
    });
  });

  return { data: res, options: parseSelector($) };
}
getHocPhi = async (options = {}) => {
  let endpoint = `${API}/StudentService/StudentTuition.aspx`;

  let $ = await request.get(endpoint, options);

  if (!options) options = parseSelector($);

  initialFormData = parseInitialFormData($);


  delete initialFormData.btnView;
  let lblStudentAccount = $('#lblStudentAccount');
  let total = $('#lblStudentAccount > span:nth-child(1)').text().trim();
  let paid = $('#lblStudentAccount > span:nth-child(2)').text().trim();
  let overage = $('#lblStudentAccount > span:nth-child(3)').text().trim();
  return { total: total, paid: paid, overage: overage };
}
getProfile = async (options = {}) => {
  let endpoint = `${API}/StudentMark.aspx`;

  let $ = await request.get(endpoint, options);

  if (!options) options = parseSelector($);

  initialFormData = parseInitialFormData($);

  delete initialFormData.btnView;

  let studentCode = $('#lblStudentCode').text().trim();
  let studentName = $('#lblStudentName').text().trim();
  let studentStatus = $('#lblstudentstatus').text().trim();
  let studentCourse = $('#lblAy').text().trim();
  let studentMajor = $('#drpField').text().trim();
  let studentClass = $('#lblAdminClass').text().trim();
  return { studentCode: studentCode, studentName: studentName, studentStatus: studentStatus, studentCourse: studentCourse, studentMajor: studentMajor, studentClass: studentClass };
}
module.exports = { init, login, parseSelector, parseInitialFormData, getTkbDkh, parseTkbDkh, getStudentMark, generateTimeline, getHocPhi, getProfile };