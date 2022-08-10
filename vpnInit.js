// vpn_init.py
'use strict'

const fs = require('fs');

const XSRV_FILE = '/usr/bin/xvfb-run';
const XSRV_PS = 'xvfb-run';
const OPERA_CMD = XSRV_FILE + ' /usr/local/opera-beta/opera-beta --no-sandbox';
const OPERA_PS = 'opera-beta';
const TIMEOUT = 20;
const PROFILE_DIR = '/root/.config/opera-beta';
const PREF_FILE = PROFILE_DIR + '/Preferences';
const S_FROM = /"freedom":{[^}]+}/;
const S_TO = '"freedom":{"proxy_switcher":{'
  + '"bytes_transferred":"0","country_code":"EU",'
  + '"enabled":true,"forbidden":false,"ui_visible":true}';

// create config
const { exec } = require('child_process');
exec(OPERA_CMD + ' & ' 
  + ' sleep ' + TIMEOUT + ' && '
  + 'killall ' + OPERA_PS
  ,(err, stdout, stderr) => {
  // don't stop on minor shell errors
  if (err) return;
  setTimeout( () => {
    fs.readFile(PREF_FILE, 'utf8', function(err, data) {
      const prefsParts = data.split(S_FROM);
      fs.writeFile(PREF_FILE, prefsParts[0] + S_TO + prefsParts[1], (err) => {
      });
    });
  }, TIMEOUT);
});

