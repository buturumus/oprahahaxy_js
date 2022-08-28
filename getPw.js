// getPw.js
'use strict'

/* Constants */

const http = require('http');
const https = require('https');
const fs = require('fs');

const XSRV_FILE = '/usr/bin/xvfb-run';
const XSRV_PS = 'xvfb-run';
const OPERA_CMD = XSRV_FILE + ' /usr/local/opera-beta/opera-beta --no-sandbox';
const OPERA_PS = 'opera-beta';
const DUMP_PREFIX = '/base/dump'
const PW_FILE = '/base/www/pw.txt'
const WPAD_TEMPL = '/base/wpad.00'
const WPAD_FILE = '/base/www/wpad.dat'
const TIMEOUT = 10000;
const PW_MIN_LEN = 700;
const TEST_URL = 'ipv4.icanhazip.com';
const PROXY_URLS = [
  'eu0.sec-tunnel.com',
  'eu1.sec-tunnel.com',
  'eu2.sec-tunnel.com',
  'eu3.sec-tunnel.com',
];
function* nextProxyUrlGen() {
  for (const proxyUrl of PROXY_URLS) yield proxyUrl;
}
const PROXY_PORT = 443;
// make array of legal pw chars to compare with
const legalPwCharCodes = [];
const mandPwCharCodes = [];
for (const limChars of [ [ 'A', 'Z' ], [ 'a', 'z' ], [ '0', '9' ], ]) {
  for (let i = limChars[0].charCodeAt(); i <= limChars[1].charCodeAt(); i++)
    legalPwCharCodes.push(i);
//  legalPwCharCodes.push(String.fromCharCode(i));
};
legalPwCharCodes.push('_'.charCodeAt());
// and array of mandatory pw chars
for (const pwChar of [ '.', '-' ]) {
  mandPwCharCodes.push(pwChar.charCodeAt());
  legalPwCharCodes.push(pwChar.charCodeAt());
//legalPwCharCodes.push(pwChar);
};


/* Global vars */

let proxyPw = '';
const pwCandids = []; 


/* Functions */

// what to do with just found pw
function usePw(pw) {
  proxyPw = pw;
  console.log('\nActual pw is:\n' + pw);
  console.log('\nWriting pw file...');
  fs.writeFile(PW_FILE, pw, (err) => {
    if (err) {
      console.log(`Error Writing pw file:\n${err}`);
      return;
    };
    console.log('file ' + PW_FILE + ' is written.');
    // now to wpad
    console.log('Writing wpad file...');
    fs.readFile(WPAD_TEMPL, 'utf8', function(err, data) {
      if (err) return;
      fs.writeFile(
        WPAD_FILE,
        data.replace(
          /const pw = \'[^\']+\'/,
          'const pw = \'' + pw + '\''
        ), 
        (err) => {
          if (err) {
            console.log(`Error Writing wpad file:\n${err}`);
            return;
          };
          console.log('file ' + WPAD_FILE + ' is written.');
        }
      );
    });
  });
}

// send a pw-candidate to proxy(-ies) to check if it's valid
function checkPw(pwCandidObj) {
  // check global var on start
  if (proxyPw) return;
  // if no next proxy to check pw-candidate then it's time to quit checks
  const proxyUrl = pwCandidObj.proxyUrlsSeq.next().value;
  if ( ! proxyUrl) {
    pwCandidObj.wrongPwCallback();
    return;
  };
  console.log('\nChecking with proxy:' + proxyUrl 
    + ' pw candid.: ' + pwCandidObj.pw);
  // run https request
  const options = {
    host: proxyUrl,
    port: PROXY_PORT,
    path: 'http://' + TEST_URL,
    headers: { 'Proxy-Authorization':
      'Basic ' + Buffer.from('0:' + pwCandidObj.pw).toString('base64')
    },
    //rejectUnauthorized:false,
  };
  // do all next jobs in response's callback
  const request = https.request(options, (resp) => {
    // check on start
    if (proxyPw) return;
    // work with resp
    if (resp.statusCode !== 200) {
      console.error('Err on resp.receive:');
      console.error(resp.statusCode);
      // on error/bad-pw goto next proxy with recursion call
      checkPw(pwCandidObj);
      return;
    };
    // get data in stream
    let data = '';
    resp.on('data', (chunk) => { data += chunk });
    // on good pw do final job in corresp.callback
    resp.on('close', () => { 
      pwCandidObj.goodPwCallback();
    });
  });
  // on some troubles with proxy-url access
  request.on('error', (err) => {
    console.error('Err on proxy connect:');
    console.error(err);
    // and goto next proxy with recursion
    checkPw(pwCandidObj);
  });
  request.end();
}

// parse dump file to find pw-candidates and to send them to check
function runPwCandids(dumpFile) {
    let pwCandid = '';
    let withMandChars = false;
    // read dump file with streams
    const readableStream = fs.createReadStream(dumpFile);
    readableStream.on('error', function (error) {
        console.log(`Read dump error: ${error.message}`);
    });
    readableStream.on('data', (chunk) => {
      for (const dumpCharCode of chunk) {
        // check the global var on start of every iteration
        if (proxyPw) return;
        //   
        if (legalPwCharCodes.includes(dumpCharCode)) {
          pwCandid += String.fromCharCode(dumpCharCode);
          if (mandPwCharCodes.includes(dumpCharCode)) withMandChars = true;
          continue;
        // or if pwCandid string finished (char is illegal) then start checks
        } else if (pwCandid.length >= PW_MIN_LEN && withMandChars
            && ( ! pwCandids.includes(pwCandid))
        ) {  
          // dbg.msg.
          console.log('\nIn the dump pw candid.found: ' + pwCandid);
          // send it to check as pw
          pwCandids.push(pwCandid);
          const proxyUrlsSeq = nextProxyUrlGen();
          const pwCandidObj = {};
          pwCandidObj.pw = pwCandid;
          pwCandidObj.proxyUrlsSeq = proxyUrlsSeq;
          pwCandidObj.goodPwCallback = function() {
            usePw(this.pw);
          };
          pwCandidObj.wrongPwCallback = () => {};
          checkPw(pwCandidObj);
        };
        // and in any case reset init.vars
        pwCandid = '';
        withMandChars = false;
      };
    });
}

// run opera and make a dump
function mkAndParseDump() {
  const { exec } = require('child_process');
  let operaPid;
  console.log('Running opera...');
  exec(OPERA_CMD + ' & '
    ,(err, stdout, stderr) => {
      if (err) {
        console.error('err:');
        console.error(err);
        return;
      };
  });
  setTimeout( () => {
    // find opera pid
    exec('ps -aux | grep ' + OPERA_PS + ' | grep -v ' + XSRV_PS 
    ,(err, stdout, stderr) => {
      operaPid = stdout.split(/\r?\n/)[0].split(/ +/)[1];
      if ( ! operaPid ) return;
      console.log('Dumping...');
      // make a dump
      exec(
        'rm -f ' + DUMP_PREFIX + '.*'
        + ' && gcore -o ' + DUMP_PREFIX + ' ' + operaPid
        + ' && killall ' + OPERA_PS
      ,(err, stdout, stderr ) => {
        if (err) return;
        // if the dump exists(was created)
        fs.access(DUMP_PREFIX + '.' + operaPid, fs.F_OK, (err) => {
          if (err) return;
          runPwCandids(DUMP_PREFIX + '.' + operaPid);
        });
      });
    });
  }, TIMEOUT);
}

// for a start check pw from old pw file 
function checkPrevPw() {
  // check if pw file exists
  fs.access(PW_FILE, fs.F_OK, (err) => {
    if (err) {
      console.log('No old pw file, starting new search');
      mkAndParseDump();
      return;
    };
    // read old pw from file
    fs.readFile(PW_FILE, 'utf8', function(err, data) {
      if (err) return;
      // check pw and run new search if not success
      console.log('Trying to check old pw: ' + data);
      const proxyUrlsSeq = nextProxyUrlGen();
      const pwCandidObj = {};
      pwCandidObj.pw = data;
      pwCandidObj.proxyUrlsSeq = proxyUrlsSeq;
      pwCandidObj.goodPwCallback = function() {
        console.log('\nOld pw is ok');
      };
      pwCandidObj.wrongPwCallback = function() {
        console.log('\nOld pw is wrong, searching fresh one');
        mkAndParseDump();
      };
      checkPw(pwCandidObj);
    });
  });

}


/* Run */

checkPrevPw();

