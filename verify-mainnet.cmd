REM Verify the two mainnet contracts on Polygonscan.
REM Requires POLYGONSCAN_API_KEY set in .env (already present).
REM Run each line separately:

npx hardhat verify --network polygon 0xf61e4881f363b30384dfbcf1c72845cce94d4f9f

npx hardhat verify --network polygon 0x0465161D9aeD6e1C2F9E986Be97F5628E46421D3 0xf61e4881f363b30384dfbcf1c72845cce94d4f9f 0x3c499c542cEF5E3811e1192ce70d8cC03d5c3359
