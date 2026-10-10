@echo off
chcp 65001 >nul
cd /d "D:\Program Files (x86)\Tencent\微信web开发者工具"
set ELECTRON_RUN_AS_NODE=1
".\微信开发者工具.exe" -e "const e=process.argv[1],a=process.argv.slice(2).filter(function(x){return x!=='--electron'});if(!process.env.cwd)process.env.cwd=process.cwd();process.argv=[process.execPath,e,'--electron'].concat(a);require(e)" ".\resources\app.asar.unpacked\js\common\cli\skill-index.js" -c Qoder get_simulator_console --project "E:\Documents\weixin-project\majiang-xiaoxiao\cocos\build\wechatgame" --command "grep -n ."
