#!/usr/bin/python3

# get_pw.py

import requests, subprocess
import os, time
import string, re

PROXY_NUMS = [ '0', '1', '2', '3' ]
TEST_URL = 'http://ipv4.icanhazip.com'
NET_ATTEMPTS = 3
PW_FILE = '/base/www/pw.txt'
XSRV_FILE = '/usr/bin/xvfb-run'
XSRV_PS = 'xvfb-run'
OPERA_CMD = XSRV_FILE + ' /usr/local/opera-beta/opera-beta --no-sandbox'
OPERA_CMD_LIST = ['/usr/local/opera-beta/opera-beta', '--no-sandbox']
OPERA_PS = 'opera-beta'
TIMEOUT = 15
PW_MIN_LEN = 700
INSUR_FREE_MB = 9000
DUMP_PREFIX = '/base/dump'
INSUR_SUFFIX = '.insur.tmp'
PW_FILE = '/base/www/pw.txt'
WPAD_TEMPL = '/base/wpad.00'
WPAD_FILE = '/base/www/wpad.dat'

def is_pw_ok(pw_candid):
    for proxy_num in PROXY_NUMS:
        res = requests.get(TEST_URL, proxies={
            'http': (
                'https://0:' + pw_candid 
                + '@eu' + proxy_num + '.sec-tunnel.com:443'
            ),
            'https': (
                'https://0:' + pw_candid 
                + '@eu' + proxy_num + '.sec-tunnel.com:443'
            ),
        }).text
        if res: return True
    return False
        
# for a start check pw from old pw file 
if os.path.exists(PW_FILE):
    pw_candid = ''
    with open(PW_FILE, 'r', errors='ignore') as pw_file:
        pw_candid = pw_file.readline()
        for attempt in range(1, NET_ATTEMPTS):
            if is_pw_ok(pw_candid):
                quit()

# if old pw is wrong run new search
for attempt in range(1):
    os.system(OPERA_CMD + ' & ')
    time.sleep(TIMEOUT) # wait until it compl.starts
    ps = os.popen(
        'ps -aux' 
    ).read()
    # get pid
    opera_pid = os.popen(
        'ps -aux | grep ' + OPERA_PS + ' | grep -v ' + XSRV_PS
    ).readline().split()[1]
    # make insur.file
    one_mb = b'\0' * 1024 * 1024
    with open(DUMP_PREFIX + INSUR_SUFFIX, 'wb') as insur_file:
        for i in range(INSUR_FREE_MB):
            try:
                insur_file.write(one_mb)
            except:
                break
    # make dump
    os.system('gcore -o ' + DUMP_PREFIX + ' ' + opera_pid)
    os.remove(DUMP_PREFIX + INSUR_SUFFIX)
    os.system('killall ' + OPERA_PS)
    # parse dump
    ok_pw = ''
    with open(
        DUMP_PREFIX + '.' + opera_pid, errors='ignore'
    ) as dump_file:
        line = ''
        for c in dump_file.read():
            if ( c in string.ascii_letters
                or c in string.digits
                or c in '_-.'
            ):
                line += c
                continue
            elif ( len(line) >= PW_MIN_LEN
                and is_pw_ok(line) 
            ):
                ok_pw = line
                break
            line = ''
#   os.remove(DUMP_PREFIX + '.' + opera_pid)
    if ok_pw: break
    time.sleep(TIMEOUT)
# if good pw's not found yet then leave it all
if not ok_pw: quit()
# upd.pw file
with open(PW_FILE, 'w', errors='ignore') as pw_file:
    pw_file.write(ok_pw)
    try: pw_file.trancate()
    except: pass
# upd.wpad file
with open(WPAD_TEMPL, 'r', errors='ignore') as wpad_templ:
    wpad_cont = re.sub(
        'const pw = \'[^\']+\'',
        'const pw = \'' + ok_pw + '\'',
        wpad_templ.read()
    )
    with open(WPAD_FILE, 'w', errors='ignore') as wpad_file:
        wpad_file.write(wpad_cont)
        try: wpad_file.trancate()
        except: pass

