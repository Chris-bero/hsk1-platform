#!/bin/bash
# Automated tests (Node). Extracts app scripts and runs them against a DOM stub.
cd "$(dirname "$0")/.."
python3 -c "
import re
for src,dst in [('index.html','/tmp/app.js'),('admin.html','/tmp/admin.js')]:
    html=open(src).read()
    js=re.search(r'<script>(.*)</script>', html, re.S).group(1)
    open(dst,'w').write(js)
"
node --check /tmp/app.js   || { echo "index.html syntax FAIL"; exit 1; }
node --check /tmp/admin.js || { echo "admin.html syntax FAIL"; exit 1; }
node tests/logic.test.js || exit 1
node tests/admin.smoke.js || exit 1
node tests/chapter01.test.js || exit 1
node tests/chapter02.test.js || exit 1
node tests/chapter03.test.js || exit 1
node tests/chapter04.test.js || exit 1
node tests/chapter05.test.js || exit 1
node tests/chapter06.test.js || exit 1
node tests/chapter07.test.js || exit 1
node tests/chapter08.test.js || exit 1
node tests/chapter09.test.js || exit 1
node tests/chapter10.test.js || exit 1
node tests/chapter11.test.js || exit 1
node tests/chapter12.test.js || exit 1
node tests/chapter13.test.js || exit 1
node tests/chapter14.test.js || exit 1
node tests/chapter15.test.js || exit 1
node tests/sync.test.js || exit 1
node tests/analytics.test.js || exit 1
node tests/separation.test.js || exit 1
node tests/admin_teacher.smoke.js || exit 1
