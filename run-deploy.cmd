@echo off
cd /d C:\Users\USER\sharma\alpha-signal-trade
echo === RUN START %date% %time% === > deploy-log.txt
node scripts\resume-mainnet-standalone.js >> deploy-log.txt 2>&1
echo === NODE EXITCODE %ERRORLEVEL% === >> deploy-log.txt
