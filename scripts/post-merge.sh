#!/bin/bash
set -e

git config credential.helper "/bin/bash $(pwd)/scripts/git-credential-helper.sh"
git config user.email "baimasonga@gmail.com"
git config user.name "baimasonga"
git remote set-url origin "https://github.com/baimasonga/AVDP-Dashboard.git"
