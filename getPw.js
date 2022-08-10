// getPw.js
'use strict'

/* constants */

const http = require('http');
const https = require('https');
const fs = require('fs');

const XSRV_FILE = '/usr/bin/xvfb-run';
const XSRV_PS = 'xvfb-run';
const OPERA_CMD = XSRV_FILE + ' /usr/local/opera-beta/opera-beta --no-sandbox';
const OPERA_PS = 'opera-beta';
const DUMP_PREFIX = '/base/dump'
const WPAD_TEMPL = '/base/wpad.00'
const WPAD_FILE = '/base/www/wpad.dat'
const DUMP_BLOCK_SZ = '100000'
const TIMEOUT = 10;
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


/* globals */

let proxyPw = '';
const pwCandids = []; 


/* functions */

// what to do with just found pw
function usePw(pw) {
  proxyPw = pw;
  console.log('pw:');
  console.log(pw);
}

// send a pw-candidate to proxy(-ies) to check if it's valid
function checkPw(pwCandid, proxyUrlsSeq) {
  // checks on start
  if (proxyPw) return;
  const proxyUrl = proxyUrlsSeq.next().value;
  if (! proxyUrl) return;
  // dbg.msg.
  console.log(' ');
  console.log('checking with proxy ' + proxyUrl + ' pw candid.: ' + pwCandid);
  // run https request
  const options = {
    host: proxyUrl,
    port: PROXY_PORT,
    path: 'http://' + TEST_URL,
    headers: { 'Proxy-Authorization':
      'Basic ' + Buffer.from('0:' + pwCandid).toString('base64')
    },
    //rejectUnauthorized:false,
  };
  // do all next jobs in response's callback
  const request = https.request(options, (resp) => {
    // check on start
    if (proxyPw) return;
    // work with resp
    if (resp.statusCode !== 200) {
      console.error('err on receive');
      console.error(resp.statusCode);
      // on error/bad-pw goto next proxy with recursion call
      checkPw(pwCandid, proxyUrlsSeq);
      return;
    };
    let data = '';
    resp.on('data', (chunk) => {
      data += chunk;
    });
    // on good pw do final job in callback
    resp.on('close', () => {
      usePw(pwCandid);
    });
  });
  // on some troubles with proxy-url access
  request.on('error', (err) => {
    console.error('err on send:');
    console.error(err);
    // on error goto next proxy with recursion
    checkPw(pwCandid, proxyUrlsSeq);
  });
  request.end();
}

// parse a dump file to find pw-candidates and to send them for check
function runPwCandids(dumpFile) {
    let pwCandid = '';
    let withMandChars = false;
    // read dump file with streams
    const readableStream = fs.createReadStream(dumpFile);
    readableStream.on('error', function (error) {
        console.log(`error: ${error.message}`);
    });
    readableStream.on('data', (chunk) => {
      for (const dumpCharCode of chunk) {
        // check on start of an iteration
        if (proxyPw) return;
        //   
        if (legalPwCharCodes.includes(dumpCharCode)) {
          pwCandid += String.fromCharCode(dumpCharCode);
          if (mandPwCharCodes.includes(dumpCharCode)) withMandChars = true;
          continue;
        // or if pwCandid string finished (char is illegal) 
        // check it
        } else if (pwCandid.length >= PW_MIN_LEN && withMandChars
            && ( ! pwCandids.includes(pwCandid))
        ) {  
          // and if the pwCandid is ok

          console.log(' ');
          console.log('pw candid.found: ' + pwCandid);

          pwCandids.push(pwCandid);
          const proxyUrlsSeq = nextProxyUrlGen();
          checkPw(pwCandid, proxyUrlsSeq);
        };
        // and in any case reset init.vars
        pwCandid = '';
        withMandChars = false;
      };
    });
}

// run opera and make a dump
function mkDump() {
  const { exec } = require('child_process');
  let operaPid;
  // run opera
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
    exec(
      'ps -aux | grep ' + OPERA_PS 
      + ' | grep -v ' + XSRV_PS 
    ,(err, stdout, stderr) => {
      operaPid = stdout.split(/\r?\n/)[0].split(/ +/)[1];
      if ( ! operaPid ) return;
      console.log('dumping');
      // make dump
      exec(
        'rm -f ' + DUMP_PREFIX + '.*'
        + ' && gcore -o ' + DUMP_PREFIX + ' ' + operaPid
        + ' && killall ' + OPERA_PS
        + ' && ls -1 ' + DUMP_PREFIX + '.*'
      ,(err, stdout, stderr ) => {
        if (err) return;
        // if dump exists
        fs.access(DUMP_PREFIX + '.' + operaPid, fs.F_OK, (err) => {
          if (err) return;
          runPwCandids(DUMP_PREFIX + '.' + operaPid);
        });
      });
    });
  }, 10000);
}

// for a start check pw from old pw file 
funciont checkPrevPw() {
  // if pw file exists
  fs.access(DUMP_PREFIX + '.' + operaPid, fs.F_OK, (err) => {
    if (err) return;

  });
}


/* run */

mkDump();
